export type CallPeer = {
  id: string
  name: string
  stream: MediaStream | null
  audio: boolean
  video: boolean
}

type SignalData = {
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]

export class CallSession {
  private socket: WebSocket | null = null
  private selfId = ''
  private peers = new Map<string, RTCPeerConnection>()
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>()
  private roster: CallPeer[] = []
  private stopped = false
  private stream: MediaStream
  private listeners: {
    onPeers: (peers: CallPeer[]) => void
    onOpen: () => void
    onError: (message: string) => void
    onClose: () => void
  }

  constructor(
    stream: MediaStream,
    listeners: {
      onPeers: (peers: CallPeer[]) => void
      onOpen: () => void
      onError: (message: string) => void
      onClose: () => void
    },
  ) {
    this.stream = stream
    this.listeners = listeners
  }

  connect(url: string, token: string, roomId: string) {
    const socket = new WebSocket(url)
    this.socket = socket

    socket.addEventListener('open', () => {
      this.send({ type: 'join', token, roomId })
    })
    socket.addEventListener('message', (event) => {
      void this.onMessage(String(event.data))
    })
    socket.addEventListener('close', () => {
      const unexpected = !this.stopped
      this.stopped = true
      this.cleanupConnections()
      for (const track of this.stream.getTracks()) track.stop()
      if (unexpected) this.listeners.onClose()
    })
    socket.addEventListener('error', () => {
      this.fail('The call could not connect. Check that the API is running.')
    })
  }

  setMicEnabled(enabled: boolean) {
    for (const track of this.stream.getAudioTracks()) track.enabled = enabled
    this.sendMedia()
  }

  setCameraEnabled(enabled: boolean) {
    for (const track of this.stream.getVideoTracks()) track.enabled = enabled
    this.sendMedia()
  }

  stop() {
    if (this.stopped) return
    this.stopped = true
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'leave' }))
    }
    this.socket?.close()
    this.cleanupConnections()
    for (const track of this.stream.getTracks()) track.stop()
  }

  private fail(message: string) {
    this.listeners.onError(message)
    this.stop()
  }

  private send(message: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  private sendMedia() {
    const audio = this.stream.getAudioTracks().some((track) => track.enabled)
    const video = this.stream.getVideoTracks().some((track) => track.enabled)
    this.send({ type: 'media', audio, video })
  }

  private publish(peers: CallPeer[]) {
    this.roster = peers
    this.listeners.onPeers(peers)
  }

  private async onMessage(raw: string) {
    let message: {
      type?: string
      selfId?: string
      peers?: { id: string; name: string }[]
      peer?: { id: string; name: string }
      peerId?: string
      from?: string
      data?: SignalData
      audio?: boolean
      video?: boolean
      message?: string
    }

    try {
      message = JSON.parse(raw) as typeof message
    } catch {
      return
    }

    if (message.type === 'joined' && message.selfId) {
      this.selfId = message.selfId
      const peers = (message.peers ?? []).map((peer) => ({
        id: peer.id,
        name: peer.name,
        stream: null,
        audio: true,
        video: true,
      }))
      this.publish(peers)
      this.listeners.onOpen()
      this.sendMedia()
      await Promise.all(peers.map((peer) => this.offer(peer.id)))
      return
    }

    if (message.type === 'peer-joined' && message.peer) {
      const peer = message.peer
      if (!this.roster.some((item) => item.id === peer.id)) {
        this.publish([
          ...this.roster,
          { id: peer.id, name: peer.name, stream: null, audio: true, video: true },
        ])
      }
      this.sendMedia()
      await this.offer(peer.id)
      return
    }

    if (message.type === 'peer-left' && message.peerId) {
      this.peers.get(message.peerId)?.close()
      this.peers.delete(message.peerId)
      this.pendingCandidates.delete(message.peerId)
      this.publish(this.roster.filter((peer) => peer.id !== message.peerId))
      return
    }

    if (message.type === 'signal' && message.from && message.data) {
      await this.handleSignal(message.from, message.data)
      return
    }

    if (message.type === 'media' && message.from) {
      this.publish(
        this.roster.map((peer) =>
          peer.id === message.from
            ? { ...peer, audio: Boolean(message.audio), video: Boolean(message.video) }
            : peer,
        ),
      )
      return
    }

    if (message.type === 'error' || message.type === 'replaced') {
      this.fail(message.message || 'The call ended')
    }
  }

  private ensurePeer(peerId: string) {
    const existing = this.peers.get(peerId)
    if (existing) return existing

    const connection = new RTCPeerConnection({ iceServers })
    for (const track of this.stream.getTracks()) {
      connection.addTrack(track, this.stream)
    }

    connection.addEventListener('icecandidate', (event) => {
      if (!event.candidate) return
      this.send({
        type: 'signal',
        to: peerId,
        data: { candidate: event.candidate.toJSON() },
      })
    })

    connection.addEventListener('track', (event) => {
      const remoteStream = event.streams[0]
      if (!remoteStream) return
      this.publish(
        this.roster.map((peer) =>
          peer.id === peerId ? { ...peer, stream: remoteStream } : peer,
        ),
      )
    })

    this.peers.set(peerId, connection)
    return connection
  }

  private async offer(peerId: string) {
    if (!this.selfId || this.selfId >= peerId) return

    const connection = this.ensurePeer(peerId)
    if (connection.signalingState !== 'stable') return

    const description = await connection.createOffer()
    await connection.setLocalDescription(description)
    if (!connection.localDescription) return

    this.send({
      type: 'signal',
      to: peerId,
      data: { description: connection.localDescription },
    })
  }

  private async handleSignal(peerId: string, data: SignalData) {
    const connection = this.ensurePeer(peerId)

    if (data.description) {
      const offerWhileBusy =
        data.description.type === 'offer' && connection.signalingState !== 'stable'
      if (offerWhileBusy) return

      await connection.setRemoteDescription(data.description)
      const queued = this.pendingCandidates.get(peerId) ?? []
      this.pendingCandidates.delete(peerId)
      for (const candidate of queued) {
        await connection.addIceCandidate(candidate)
      }

      if (data.description.type === 'offer') {
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        if (connection.localDescription) {
          this.send({
            type: 'signal',
            to: peerId,
            data: { description: connection.localDescription },
          })
        }
      }
      return
    }

    if (!data.candidate) return

    if (!connection.remoteDescription) {
      const queued = this.pendingCandidates.get(peerId) ?? []
      queued.push(data.candidate)
      this.pendingCandidates.set(peerId, queued)
      return
    }

    await connection.addIceCandidate(data.candidate)
  }

  private cleanupConnections() {
    for (const connection of this.peers.values()) connection.close()
    this.peers.clear()
    this.pendingCandidates.clear()
  }
}
