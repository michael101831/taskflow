import { Router } from 'express'
import { moveDetail, recordActivity } from '../lib/activity.js'
import { prisma } from '../lib/prisma.js'
import {
  parseTaskInput,
  priorityToDatabase,
  serializeTask,
  statusToDatabase,
} from '../taskData.js'

export const tasksRouter = Router({ mergeParams: true })

async function isProjectMember(projectId: string, userId: string | null) {
  if (!userId) return true

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  })

  return Boolean(membership)
}

tasksRouter.get('/', async (request, response, next) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { projectId: response.locals.projectId as string },
      include: { assignee: true },
      orderBy: { id: 'asc' },
    })

    response.json(tasks.map(serializeTask))
  } catch (error) {
    next(error)
  }
})

tasksRouter.post('/', async (request, response, next) => {
  const input = parseTaskInput(request.body)

  if (!input) {
    response.status(400).json({ message: 'Invalid task data' })
    return
  }

  try {
    if (
      !(await isProjectMember(
        response.locals.projectId as string,
        input.assigneeId,
      ))
    ) {
      response.status(400).json({ message: 'Assignee is not a project member' })
      return
    }

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: statusToDatabase[input.status],
        priority: priorityToDatabase[input.priority],
        dueDate: new Date(`${input.dueDate}T00:00:00.000Z`),
        projectId: response.locals.projectId as string,
        assigneeId: input.assigneeId,
      },
      include: { assignee: true },
    })

    await recordActivity({
      projectId: response.locals.projectId as string,
      actorId: response.locals.user.uid as string,
      kind: 'TASK_CREATED',
      subject: task.title,
    })

    response.status(201).json(serializeTask(task))
  } catch (error) {
    next(error)
  }
})

tasksRouter.put('/:id', async (request, response, next) => {
  const id = Number(request.params.id)
  const input = parseTaskInput(request.body)

  if (!Number.isInteger(id) || id < 1 || !input) {
    response.status(400).json({ message: 'Invalid task data' })
    return
  }

  try {
    if (
      !(await isProjectMember(
        response.locals.projectId as string,
        input.assigneeId,
      ))
    ) {
      response.status(400).json({ message: 'Assignee is not a project member' })
      return
    }

    const projectId = response.locals.projectId as string
    const existing = await prisma.task.findFirst({
      where: { id, projectId },
      select: { status: true },
    })
    const task = await prisma.task.update({
      where: { id, projectId },
      data: {
        title: input.title,
        description: input.description,
        status: statusToDatabase[input.status],
        priority: priorityToDatabase[input.priority],
        dueDate: new Date(`${input.dueDate}T00:00:00.000Z`),
        assigneeId: input.assigneeId,
      },
      include: { assignee: true },
    })

    if (existing && existing.status !== task.status) {
      await recordActivity({
        projectId,
        actorId: response.locals.user.uid as string,
        kind: 'TASK_MOVED',
        subject: task.title,
        detail: moveDetail(existing.status, task.status),
      })
    }

    response.json(serializeTask(task))
  } catch (error) {
    next(error)
  }
})

tasksRouter.delete('/:id', async (request, response, next) => {
  const id = Number(request.params.id)

  if (!Number.isInteger(id) || id < 1) {
    response.status(400).json({ message: 'Invalid task ID' })
    return
  }

  try {
    await prisma.task.delete({
      where: { id, projectId: response.locals.projectId as string },
    })
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

function commentId(value: unknown) {
  return typeof value === 'string' ? value : ''
}

tasksRouter.get('/:id/comments', async (request, response, next) => {
  const id = Number(request.params.id)

  if (!Number.isInteger(id) || id < 1) {
    response.status(400).json({ message: 'Invalid task ID' })
    return
  }

  try {
    const task = await prisma.task.findFirst({
      where: { id, projectId: response.locals.projectId as string },
      select: { id: true },
    })

    if (!task) {
      response.status(404).json({ message: 'Task not found' })
      return
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId: task.id },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    })

    response.json(
      comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        author: {
          id: comment.author.id,
          email: comment.author.email,
          displayName: comment.author.displayName,
        },
      })),
    )
  } catch (error) {
    next(error)
  }
})

tasksRouter.post('/:id/comments', async (request, response, next) => {
  const id = Number(request.params.id)
  const body = typeof request.body?.body === 'string' ? request.body.body.trim() : ''

  if (!Number.isInteger(id) || id < 1) {
    response.status(400).json({ message: 'Invalid task ID' })
    return
  }

  if (!body || body.length > 1000) {
    response.status(400).json({ message: 'A comment must be 1 to 1000 characters' })
    return
  }

  try {
    const task = await prisma.task.findFirst({
      where: { id, projectId: response.locals.projectId as string },
      select: { id: true },
    })

    if (!task) {
      response.status(404).json({ message: 'Task not found' })
      return
    }

    const comment = await prisma.taskComment.create({
      data: {
        body,
        taskId: task.id,
        authorId: response.locals.user.uid as string,
      },
      include: { author: true },
    })

    response.status(201).json({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: {
        id: comment.author.id,
        email: comment.author.email,
        displayName: comment.author.displayName,
      },
    })
  } catch (error) {
    next(error)
  }
})

tasksRouter.delete('/:id/comments/:commentId', async (request, response, next) => {
  const id = Number(request.params.id)
  const targetId = commentId(request.params.commentId)

  if (!Number.isInteger(id) || id < 1 || !targetId) {
    response.status(400).json({ message: 'Invalid comment' })
    return
  }

  try {
    const comment = await prisma.taskComment.findFirst({
      where: {
        id: targetId,
        taskId: id,
        task: { projectId: response.locals.projectId as string },
      },
    })

    if (!comment) {
      response.status(404).json({ message: 'Comment not found' })
      return
    }

    if (comment.authorId !== response.locals.user.uid) {
      response.status(403).json({ message: 'You can only delete your own comments' })
      return
    }

    await prisma.taskComment.delete({ where: { id: comment.id } })
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})
