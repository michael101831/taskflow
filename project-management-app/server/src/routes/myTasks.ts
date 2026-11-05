import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { serializeAssignedTask } from '../taskData.js'

export const myTasksRouter = Router()

myTasksRouter.get('/mine', async (_request, response, next) => {
  try {
    const userId = response.locals.user.uid as string
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        project: { members: { some: { userId } } },
      },
      include: {
        assignee: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    })

    response.json(tasks.map(serializeAssignedTask))
  } catch (error) {
    next(error)
  }
})
