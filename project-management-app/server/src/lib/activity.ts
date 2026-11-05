import { ActivityKind, TaskStatus, type Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

type ActivityDb = Prisma.TransactionClient | typeof prisma

const statusLabel: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
}

export function moveDetail(from: TaskStatus, to: TaskStatus) {
  return `${statusLabel[from]} to ${statusLabel[to]}`
}

export async function recordActivity(
  input: {
    projectId: string
    actorId: string
    kind: ActivityKind
    subject: string
    detail?: string | null
  },
  db: ActivityDb = prisma,
) {
  await db.activityEvent.create({
    data: {
      projectId: input.projectId,
      actorId: input.actorId,
      kind: input.kind,
      subject: input.subject,
      detail: input.detail ?? null,
    },
  })
}
