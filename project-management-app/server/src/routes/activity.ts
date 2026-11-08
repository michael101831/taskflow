import { ActivityKind } from '@prisma/client'
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { serializeUser } from '../lib/users.js'

const kindToClient: Record<ActivityKind, string> = {
  TASK_CREATED: 'task-created',
  TASK_MOVED: 'task-moved',
  MEMBER_ADDED: 'member-added',
  CHAT_CREATED: 'chat-created',
}

export const activityRouter = Router({ mergeParams: true })

activityRouter.get('/', async (_request, response, next) => {
  try {
    const events = await prisma.activityEvent.findMany({
      where: { projectId: response.locals.projectId as string },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    response.json(
      events.map((event) => ({
        id: event.id,
        kind: kindToClient[event.kind],
        subject: event.subject,
        detail: event.detail,
        createdAt: event.createdAt.toISOString(),
        actor: serializeUser(event.actor),
      })),
    )
  } catch (error) {
    next(error)
  }
})
