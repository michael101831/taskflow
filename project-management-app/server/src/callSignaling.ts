import type { Server as HttpServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { adminAuth } from './lib/firebaseAdmin.js'
import { prisma } from './lib/prisma.js'

type PeerInfo = { id: string; name: string }

type Member = {
  socket: WebSocket
  userId: string
  name: string
  roomId: string
}

const rooms = new Map<string, Map<string, Member>>()

function send(socket: WebSocket, message: object) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

function peersExcept(roomId: string, userId: string): PeerInfo[] {
  const room = rooms.get(roomId)
  if (!room) return []

  const peers: PeerInfo[] = []
  for (const member of room.values()) {
    if (member.userId !== userId) {
      peers.push({ id: member.userId, name: member.name })
    }
  }
  return peers
}

function removeMember(member: Member) {
  const room = rooms.get(member.roomId)
  if (!room) return

  const current = room.get(member.userId)
  if (current?.socket !== member.socket) return

  room.delete(member.userId)
  if (room.size === 0) rooms.delete(member.roomId)

  for (const other of room.values()) {
    send(other.socket, { type: 'peer-left', peerId: member.userId })
  }
}

async function joinRoom(socket: WebSocket, token: string, roomId: string) {
  if (!token || !roomId) {
    throw new Error('Sign in and choose a room before joining a call')
  }

  const decoded = await adminAuth.verifyIdToken(token)
  const invite = await prisma.callRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: decoded.uid } },
    include: { user: true },
  })

  if (!invite) {
    throw new Error('You are not invited to this room')
  }

  const name = invite.user.displayName?.trim() || invite.user.email
  const room = rooms.get(roomId) ?? new Map<string, Member>()
  rooms.set(roomId, room)

  const previous = room.get(decoded.uid)
  if (previous && previous.socket !== socket) {
    room.delete(decoded.uid)
    send(previous.socket, {
      type: 'replaced',
      message: 'You joined this call in another window',
    })
    previous.socket.close()
  }

  const peers = peersExcept(roomId, decoded.uid)
  const member: Member = { socket, userId: decoded.uid, name, roomId }
  room.set(decoded.uid, member)

  send(socket, { type: 'joined', selfId: decoded.uid, peers })
  for (const other of room.values()) {
    if (other.userId === decoded.uid) continue
    send(other.socket, { type: 'peer-joined', peer: { id: decoded.uid, name } })
  }

  return member
}

export function attachCallSignaling(server: HttpServer) {
  const sockets = new WebSocketServer({ server, path: '/call' })

  sockets.on('connection', (socket) => {
    let member: Member | null = null

    socket.on('message', (raw) => {
      void handleMessage(raw.toString()).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'The call failed'
        send(socket, { type: 'error', message })
        socket.close()
      })
    })

    socket.on('close', () => {
      if (member) removeMember(member)
    })

    async function handleMessage(raw: string) {
      const message = JSON.parse(raw) as {
        type?: string
        token?: string
        roomId?: string
        to?: string
        data?: unknown
        audio?: boolean
        video?: boolean
      }

      if (message.type === 'join') {
        if (member) return
        member = await joinRoom(socket, message.token ?? '', message.roomId ?? '')
        return
      }

      if (!member) {
        send(socket, { type: 'error', message: 'Join the call first' })
        return
      }

      if (message.type === 'signal' && message.to) {
        const target = rooms.get(member.roomId)?.get(message.to)
        if (target) {
          send(target.socket, {
            type: 'signal',
            from: member.userId,
            data: message.data,
          })
        }
        return
      }

      if (message.type === 'media') {
        const room = rooms.get(member.roomId)
        if (!room) return
        for (const other of room.values()) {
          if (other.userId === member.userId) continue
          send(other.socket, {
            type: 'media',
            from: member.userId,
            audio: Boolean(message.audio),
            video: Boolean(message.video),
          })
        }
      }
    }
  })

  return sockets
}
