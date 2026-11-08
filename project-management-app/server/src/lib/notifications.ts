import { NotificationKind, type Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

type NotificationDb = Prisma.TransactionClient | typeof prisma

export async function notifyUsers(
  input: {
    recipientIds: string[]
    actorId: string
    projectId: string
    kind: NotificationKind
    subject: string
    detail?: string | null
    taskId?: number | null
    conversationId?: string | null
    callRoomId?: string | null
  },
  db: NotificationDb = prisma,
) {
  const recipientIds = [
    ...new Set(input.recipientIds.filter((id) => id && id !== input.actorId)),
  ]

  if (recipientIds.length === 0) return

  await db.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      actorId: input.actorId,
      projectId: input.projectId,
      kind: input.kind,
      subject: input.subject,
      detail: input.detail ?? null,
      taskId: input.taskId ?? null,
      conversationId: input.conversationId ?? null,
      callRoomId: input.callRoomId ?? null,
    })),
  })
}

export function messagePreview(body: string) {
  const trimmed = body.trim()
  if (trimmed.length <= 80) return trimmed
  return `${trimmed.slice(0, 77)}...`
}
