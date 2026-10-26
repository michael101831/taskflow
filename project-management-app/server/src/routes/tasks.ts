import { Router } from 'express'
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

    const task = await prisma.task.update({
      where: { id, projectId: response.locals.projectId as string },
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
