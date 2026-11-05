import { Router } from 'express'
import {
  createConversation,
  findMemberConversation,
  leaveOrDeleteConversation,
  listConversations,
  serializeConversation,
} from '../lib/conversations.js'
import { recordActivity } from '../lib/activity.js'
import { prisma } from '../lib/prisma.js'

export const conversationsRouter = Router({ mergeParams: true })

function serializeMessage(
  message: {
    id: string
    body: string
    createdAt: Date
    author: { id: string; email: string; displayName: string | null }
  },
  role: string | null,
) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    author: {
      id: message.author.id,
      email: message.author.email,
      displayName: message.author.displayName,
      role,
    },
  }
}

conversationsRouter.get('/', async (_request, response, next) => {
  try {
    const projectId = response.locals.projectId as string
    const userId = response.locals.user.uid as string
    const conversations = await listConversations(projectId, userId)

    response.json(
      conversations.map((conversation) =>
        serializeConversation(conversation, userId),
      ),
    )
  } catch (error) {
    next(error)
  }
})

conversationsRouter.post('/', async (request, response, next) => {
  const kind = request.body?.kind
  const memberIds = Array.isArray(request.body?.memberIds)
    ? request.body.memberIds.filter((id: unknown) => typeof id === 'string')
    : []
  const name = typeof request.body?.name === 'string' ? request.body.name : undefined
  const wholeProject = request.body?.wholeProject === true

  if (kind !== 'direct' && kind !== 'group') {
    response.status(400).json({ message: 'Choose a direct message or a group' })
    return
  }

  if (wholeProject && !response.locals.membership.role.isManager) {
    response.status(403).json({ message: 'Only a manager can create a project group' })
    return
  }

  try {
    const result = await createConversation({
      projectId: response.locals.projectId as string,
      creatorId: response.locals.user.uid as string,
      kind,
      name,
      memberIds,
      wholeProject,
      isManager: response.locals.membership.role.isManager,
    })

    if ('error' in result) {
      response
        .status(result.error === 'Only a manager can create a project group' ? 403 : 400)
        .json({ message: result.error })
      return
    }

    const conversation = serializeConversation(
      result.conversation,
      response.locals.user.uid as string,
    )

    if (result.created) {
      await recordActivity({
        projectId: response.locals.projectId as string,
        actorId: response.locals.user.uid as string,
        kind: 'CHAT_CREATED',
        subject: conversation.name,
        detail: conversation.kind,
      })
    }

    response.status(result.created ? 201 : 200).json(conversation)
  } catch (error) {
    next(error)
  }
})

conversationsRouter.delete('/:conversationId', async (request, response, next) => {
  try {
    const action = await leaveOrDeleteConversation(
      response.locals.projectId as string,
      String(request.params.conversationId),
      response.locals.user.uid as string,
    )

    if (!action) {
      response.status(404).json({ message: 'Chat not found' })
      return
    }

    response.json({ action })
  } catch (error) {
    next(error)
  }
})

conversationsRouter.get(
  '/:conversationId/messages',
  async (request, response, next) => {
    try {
      const conversation = await findMemberConversation(
        response.locals.projectId as string,
        String(request.params.conversationId),
        response.locals.user.uid as string,
      )

      if (!conversation) {
        response.status(404).json({ message: 'Chat not found' })
        return
      }

      const [messages, memberships] = await Promise.all([
        prisma.message.findMany({
          where: { conversationId: conversation.id },
          include: { author: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        prisma.projectMember.findMany({
          where: { projectId: conversation.projectId },
          select: { userId: true, role: { select: { name: true } } },
        }),
      ])
      const roles = new Map(
        memberships.map((membership) => [membership.userId, membership.role.name]),
      )

      response.json(
        messages
          .reverse()
          .map((message) =>
            serializeMessage(message, roles.get(message.authorId) ?? null),
          ),
      )
    } catch (error) {
      next(error)
    }
  },
)

conversationsRouter.post(
  '/:conversationId/messages',
  async (request, response, next) => {
    const body = typeof request.body?.body === 'string' ? request.body.body.trim() : ''

    if (!body || body.length > 1000) {
      response.status(400).json({ message: 'A message must be 1 to 1000 characters' })
      return
    }

    try {
      const userId = response.locals.user.uid as string
      const conversation = await findMemberConversation(
        response.locals.projectId as string,
        String(request.params.conversationId),
        userId,
      )

      if (!conversation) {
        response.status(404).json({ message: 'Chat not found' })
        return
      }

      const message = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            body,
            projectId: conversation.projectId,
            conversationId: conversation.id,
            authorId: userId,
          },
          include: { author: true },
        })

        await tx.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        })

        return created
      })

      response.status(201).json(
        serializeMessage(message, response.locals.membership.role.name),
      )
    } catch (error) {
      next(error)
    }
  },
)

conversationsRouter.delete(
  '/:conversationId/messages/:messageId',
  async (request, response, next) => {
    try {
      const userId = response.locals.user.uid as string
      const conversation = await findMemberConversation(
        response.locals.projectId as string,
        String(request.params.conversationId),
        userId,
      )

      if (!conversation) {
        response.status(404).json({ message: 'Chat not found' })
        return
      }

      const message = await prisma.message.findFirst({
        where: {
          id: String(request.params.messageId),
          conversationId: conversation.id,
        },
      })

      if (!message) {
        response.status(404).json({ message: 'Message not found' })
        return
      }

      if (message.authorId !== userId) {
        response.status(403).json({ message: 'You can only delete your own messages' })
        return
      }

      await prisma.message.delete({ where: { id: message.id } })
      response.status(204).send()
    } catch (error) {
      next(error)
    }
  },
)
