import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'

export async function requireProjectMember(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const projectId = request.params.projectId
  const userId = response.locals.user.uid as string

  if (typeof projectId !== 'string') {
    response.status(400).json({ message: 'Invalid project ID' })
    return
  }

  try {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      include: { role: true },
    })

    if (!membership) {
      response.status(403).json({ message: 'Project access denied' })
      return
    }

    response.locals.membership = membership
    response.locals.projectId = projectId
    next()
  } catch (error) {
    next(error)
  }
}
