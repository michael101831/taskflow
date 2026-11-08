import { NotificationKind } from '@prisma/client'
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { serializeUser } from '../lib/users.js'

const kindToClient: Record<NotificationKind, string> = {
  TASK_ASSIGNED: 'task-assigned',
  MESSAGE: 'message',
  CALL_INVITE: 'call-invite',
}

export const notificationsRouter = Router()

function serializeNotification(notification: {
  id: string
  kind: NotificationKind
  subject: string
  detail: string | null
  taskId: number | null
  conversationId: string | null
  callRoomId: string | null
  readAt: Date | null
  createdAt: Date
  projectId: string
  project: { name: string }
  actor: {
    id: string
    email: string
    displayName: string | null
    photoUrl: string | null
  }
}) {
  return {
    id: notification.id,
    kind: kindToClient[notification.kind],
    subject: notification.subject,
    detail: notification.detail,
    taskId: notification.taskId,
    conversationId: notification.conversationId,
    callRoomId: notification.callRoomId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    projectId: notification.projectId,
    projectName: notification.project.name,
    actor: serializeUser(notification.actor),
  }
}

notificationsRouter.get('/', async (_request, response, next) => {
  try {
    const userId = response.locals.user.uid as string
    const [unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.notification.findMany({
        where: { userId },
        include: { actor: true, project: true },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ])

    response.json({
      unreadCount,
      items: notifications.map(serializeNotification),
    })
  } catch (error) {
    next(error)
  }
})

notificationsRouter.post('/read', async (_request, response, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: response.locals.user.uid as string, readAt: null },
      data: { readAt: new Date() },
    })
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

notificationsRouter.post('/:id/read', async (request, response, next) => {
  const id = typeof request.params.id === 'string' ? request.params.id : ''

  if (!id) {
    response.status(400).json({ message: 'Invalid notification' })
    return
  }

  try {
    const updated = await prisma.notification.updateMany({
      where: { id, userId: response.locals.user.uid as string, readAt: null },
      data: { readAt: new Date() },
    })

    if (updated.count === 0) {
      const existing = await prisma.notification.findFirst({
        where: { id, userId: response.locals.user.uid as string },
        select: { id: true },
      })

      if (!existing) {
        response.status(404).json({ message: 'Notification not found' })
        return
      }
    }

    response.status(204).send()
  } catch (error) {
    next(error)
  }
})
