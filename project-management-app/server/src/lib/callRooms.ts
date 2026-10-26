import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

const roomInclude = {
  members: {
    include: { user: true },
    orderBy: { joinedAt: 'asc' as const },
  },
} satisfies Prisma.CallRoomInclude

type CallRoomRecord = Prisma.CallRoomGetPayload<{
  include: typeof roomInclude
}>

export async function listCallRooms(projectId: string, userId: string) {
  return prisma.callRoom.findMany({
    where: { projectId, members: { some: { userId } } },
    include: roomInclude,
    orderBy: { updatedAt: 'desc' },
  })
}

export function serializeCallRoom(room: CallRoomRecord, viewerId: string) {
  const others = room.members.filter((member) => member.userId !== viewerId)
  const other = others[0]
  const name = room.directKey
    ? other?.user.displayName || other?.user.email || 'Call'
    : room.name || 'Room'

  return {
    id: room.id,
    name,
    kind: room.directKey ? ('direct' as const) : ('group' as const),
    members: room.members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      displayName: member.user.displayName,
    })),
  }
}

export async function createCallRoom(input: {
  projectId: string
  creatorId: string
  memberIds: string[]
  name?: string
}) {
  const others = [
    ...new Set(input.memberIds.filter((id) => id && id !== input.creatorId)),
  ]

  if (others.length === 0) {
    return { error: 'Invite at least one coworker' as const }
  }

  const memberships = await prisma.projectMember.findMany({
    where: {
      projectId: input.projectId,
      userId: { in: [...others, input.creatorId] },
    },
    select: { userId: true },
  })
  const allowed = new Set(memberships.map((membership) => membership.userId))

  if (!allowed.has(input.creatorId) || others.some((id) => !allowed.has(id))) {
    return { error: 'Choose people who belong to this project' as const }
  }

  const otherId = others[0]
  if (others.length === 1 && otherId) {
    const directKey = [input.creatorId, otherId].sort().join(':')
    const existing = await prisma.callRoom.findUnique({
      where: {
        projectId_directKey: { projectId: input.projectId, directKey },
      },
      include: roomInclude,
    })

    if (existing) return { room: existing, created: false as const }

    try {
      const room = await prisma.callRoom.create({
        data: {
          projectId: input.projectId,
          createdById: input.creatorId,
          directKey,
          members: {
            create: [input.creatorId, otherId].map((userId) => ({ userId })),
          },
        },
        include: roomInclude,
      })
      return { room, created: true as const }
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error
      }

      const room = await prisma.callRoom.findUnique({
        where: {
          projectId_directKey: { projectId: input.projectId, directKey },
        },
        include: roomInclude,
      })
      if (!room) throw error
      return { room, created: false as const }
    }
  }

  const name = input.name?.trim() ?? ''
  if (!name || name.length > 40) {
    return { error: 'A room name must be 1 to 40 characters' as const }
  }

  const room = await prisma.callRoom.create({
    data: {
      projectId: input.projectId,
      name,
      createdById: input.creatorId,
      members: {
        create: [input.creatorId, ...others].map((userId) => ({ userId })),
      },
    },
    include: roomInclude,
  })

  return { room, created: true as const }
}
