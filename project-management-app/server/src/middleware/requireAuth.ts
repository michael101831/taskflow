import type { NextFunction, Request, Response } from 'express'
import { adminAuth } from '../lib/firebaseAdmin.js'
import { prisma } from '../lib/prisma.js'
import { createManagedProject } from '../lib/projectSetup.js'
import { serializeUser } from '../lib/users.js'

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) {
    response.status(401).json({ message: 'Authentication required' })
    return
  }

  let user

  try {
    user = await adminAuth.verifyIdToken(token)
  } catch {
    response.status(401).json({ message: 'Invalid or expired token' })
    return
  }

  const email = user.email?.toLowerCase()

  if (!email) {
    response.status(403).json({ message: 'An email address is required' })
    return
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })

    if (existingUser && existingUser.id !== user.uid) {
      if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        response.status(409).json({ message: 'Email belongs to another user' })
        return
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: { id: user.uid },
      })
    }

    const savedUser = await prisma.user.upsert({
      where: { id: user.uid },
      update: { email },
      create: {
        id: user.uid,
        email,
        displayName: user.name ?? null,
      },
    })

    const membershipCount = await prisma.projectMember.count({
      where: { userId: user.uid },
    })

    if (membershipCount === 0) {
      const starterProject = await prisma.project.findUnique({
        where: { id: 'portfolio-launch' },
        include: { _count: { select: { members: true } } },
      })

      if (starterProject && starterProject._count.members === 0) {
        const managerRole = await prisma.role.findFirst({
          where: { projectId: starterProject.id, isManager: true },
        })

        if (managerRole) {
          await prisma.projectMember.create({
            data: {
              projectId: starterProject.id,
              userId: user.uid,
              roleId: managerRole.id,
            },
          })
        }
      } else {
        await createManagedProject({
          userId: user.uid,
          name: 'My First Project',
          description: 'A workspace for planning and tracking tasks.',
        })
      }
    }

    response.locals.user = {
      uid: savedUser.id,
      email: savedUser.email,
      displayName: savedUser.displayName,
      photoUrl: serializeUser(savedUser).photoUrl,
    }
    next()
  } catch (error) {
    next(error)
  }
}
