import { ConversationKind, Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

const conversationInclude = {
  members: {
    include: { user: true },
    orderBy: { joinedAt: 'asc' as const },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.ConversationInclude

type ConversationRecord = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude
}>

export async function ensureTeamConversation(projectId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { projectId, kind: ConversationKind.TEAM },
  })
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  })

  if (!existing) {
    try {
      return await prisma.conversation.create({
        data: {
          projectId,
          name: 'Team',
          kind: ConversationKind.TEAM,
          members: {
            create: projectMembers.map((member) => ({ userId: member.userId })),
          },
        },
      })
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error
      }
    }
  }

  const team =
    existing ??
    (await prisma.conversation.findFirst({
      where: { projectId, kind: ConversationKind.TEAM },
    }))

  if (!team) throw new Error('Team chat could not be created')

  await prisma.conversationMember.createMany({
    data: projectMembers.map((member) => ({
      conversationId: team.id,
      userId: member.userId,
    })),
    skipDuplicates: true,
  })

  return team
}

export async function listConversations(projectId: string, userId: string) {
  await ensureTeamConversation(projectId)

  return prisma.conversation.findMany({
    where: { projectId, members: { some: { userId } } },
    include: conversationInclude,
    orderBy: { updatedAt: 'desc' },
  })
}

export function serializeConversation(
  conversation: ConversationRecord,
  viewerId: string,
) {
  const lastMessage = conversation.messages[0] ?? null
  const otherMember = conversation.members.find(
    (member) => member.userId !== viewerId,
  )

  const name =
    conversation.kind === ConversationKind.DIRECT
      ? otherMember?.user.displayName ||
        otherMember?.user.email ||
        'Direct message'
      : conversation.name || 'Group'

  return {
    id: conversation.id,
    name,
    kind:
      conversation.kind === ConversationKind.TEAM
        ? 'team'
        : conversation.kind === ConversationKind.DIRECT
          ? 'direct'
          : 'group',
    updatedAt: conversation.updatedAt.toISOString(),
    members: conversation.members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      displayName: member.user.displayName,
    })),
    lastMessage: lastMessage
      ? {
          body: lastMessage.body,
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : null,
  }
}

export async function createConversation(input: {
  projectId: string
  creatorId: string
  kind: 'direct' | 'group'
  name?: string
  memberIds: string[]
  wholeProject?: boolean
  isManager?: boolean
}) {
  if (input.wholeProject) {
    if (!input.isManager) {
      return { error: 'Only a manager can create a project group' as const }
    }

    const name = input.name?.trim() ?? ''
    if (!name || name.length > 40) {
      return { error: 'A group name must be 1 to 40 characters' as const }
    }

    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId: input.projectId },
      select: { userId: true },
    })

    const conversation = await prisma.conversation.create({
      data: {
        projectId: input.projectId,
        name,
        kind: ConversationKind.GROUP,
        members: {
          create: projectMembers.map((member) => ({ userId: member.userId })),
        },
      },
      include: conversationInclude,
    })

    return { conversation, created: true as const }
  }

  const others = [...new Set(input.memberIds.filter((id) => id !== input.creatorId))]
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

  if (input.kind === 'direct') {
    const coworkerId = others[0]
    if (others.length !== 1 || !coworkerId) {
      return { error: 'A direct message needs one coworker' as const }
    }

    const directKey = [input.creatorId, coworkerId].sort().join(':')
    const existing = await prisma.conversation.findUnique({
      where: {
        projectId_directKey: { projectId: input.projectId, directKey },
      },
      include: conversationInclude,
    })

    if (existing) return { conversation: existing, created: false as const }

    const conversation = await prisma.conversation.create({
      data: {
        projectId: input.projectId,
        kind: ConversationKind.DIRECT,
        directKey,
        members: {
          create: [input.creatorId, coworkerId].map((userId) => ({ userId })),
        },
      },
      include: conversationInclude,
    })

    return { conversation, created: true as const }
  }

  const name = input.name?.trim() ?? ''

  if (!name || name.length > 40) {
    return { error: 'A group name must be 1 to 40 characters' as const }
  }

  if (others.length < 1) {
    return { error: 'Choose at least one coworker' as const }
  }

  const conversation = await prisma.conversation.create({
    data: {
      projectId: input.projectId,
      name,
      kind: ConversationKind.GROUP,
      members: {
        create: [input.creatorId, ...others].map((userId) => ({ userId })),
      },
    },
    include: conversationInclude,
  })

  return { conversation, created: true as const }
}

export function findMemberConversation(
  projectId: string,
  conversationId: string,
  userId: string,
) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      projectId,
      members: { some: { userId } },
    },
  })
}
