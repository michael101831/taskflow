import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { ensureTeamConversation } from '../lib/conversations.js'
import { createManagedProject, memberRoleFor } from '../lib/projectSetup.js'
import { requireProjectMember } from '../middleware/requireProjectMember.js'
import {
  emptyTaskCounts,
  statusFromDatabase,
  type TaskCounts,
} from '../taskData.js'

export const projectsRouter = Router()

function serializeProject(
  project: {
    id: string
    name: string
    description: string
    updatedAt: Date
    _count: { members: number; tasks: number }
  },
  role: { name: string; isManager: boolean },
  bookmarked: boolean,
  taskCounts: TaskCounts,
) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    role: role.name,
    canManage: role.isManager,
    bookmarked,
    updatedAt: project.updatedAt.toISOString(),
    memberCount: project._count.members,
    taskCount: project._count.tasks,
    taskCounts,
  }
}

async function taskCountsFor(projectIds: string[]) {
  const counts = new Map<string, TaskCounts>(
    projectIds.map((projectId) => [projectId, emptyTaskCounts()]),
  )

  if (projectIds.length === 0) return counts

  const grouped = await prisma.task.groupBy({
    by: ['projectId', 'status'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  })

  for (const row of grouped) {
    const current = counts.get(row.projectId)
    if (!current) continue
    current[statusFromDatabase[row.status]] = row._count._all
  }

  return counts
}

function serializeMember(member: {
  roleId: string
  role: { name: string; isManager: boolean }
  user: { id: string; email: string; displayName: string | null }
}) {
  return {
    id: member.user.id,
    email: member.user.email,
    displayName: member.user.displayName,
    roleId: member.roleId,
    role: member.role.name,
    canManage: member.role.isManager,
  }
}

projectsRouter.get('/', async (_request, response, next) => {
  const userId = response.locals.user.uid as string

  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        role: true,
        project: {
          include: { _count: { select: { members: true, tasks: true } } },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    const counts = await taskCountsFor(
      memberships.map((membership) => membership.project.id),
    )

    response.json(
      memberships.map(({ project, role, bookmarked }) =>
        serializeProject(
          project,
          role,
          bookmarked,
          counts.get(project.id) ?? emptyTaskCounts(),
        ),
      ),
    )
  } catch (error) {
    next(error)
  }
})

projectsRouter.post('/', async (request, response, next) => {
  const userId = response.locals.user.uid as string
  const name =
    typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  const description =
    typeof request.body?.description === 'string'
      ? request.body.description.trim()
      : ''

  if (!name || name.length > 80 || description.length > 240) {
    response.status(400).json({ message: 'Invalid project data' })
    return
  }

  try {
    const { project, managerRole } = await createManagedProject({
      userId,
      name,
      description,
    })

    response
      .status(201)
      .json(serializeProject(project, managerRole, false, emptyTaskCounts()))
  } catch (error) {
    next(error)
  }
})

projectsRouter.patch(
  '/:projectId/bookmark',
  requireProjectMember,
  async (request, response, next) => {
    if (typeof request.body?.bookmarked !== 'boolean') {
      response.status(400).json({ message: 'bookmarked must be true or false' })
      return
    }

    try {
      const membership = await prisma.projectMember.update({
        where: {
          projectId_userId: {
            projectId: response.locals.projectId as string,
            userId: response.locals.user.uid as string,
          },
        },
        data: { bookmarked: request.body.bookmarked },
        include: {
          role: true,
          project: {
            include: { _count: { select: { members: true, tasks: true } } },
          },
        },
      })

      const counts = await taskCountsFor([membership.project.id])

      response.json(
        serializeProject(
          membership.project,
          membership.role,
          membership.bookmarked,
          counts.get(membership.project.id) ?? emptyTaskCounts(),
        ),
      )
    } catch (error) {
      next(error)
    }
  },
)

projectsRouter.delete(
  '/:projectId',
  requireProjectMember,
  async (_request, response, next) => {
    if (!response.locals.membership.role.isManager) {
      response.status(403).json({
        message: 'Only the project manager can delete this project',
      })
      return
    }

    try {
      await prisma.project.delete({
        where: { id: response.locals.projectId as string },
      })
      response.status(204).send()
    } catch (error) {
      next(error)
    }
  },
)

projectsRouter.delete(
  '/:projectId/members/me',
  requireProjectMember,
  async (_request, response, next) => {
    if (response.locals.membership.role.isManager) {
      response.status(403).json({
        message: 'Managers delete the project instead of leaving it',
      })
      return
    }

    const projectId = response.locals.projectId as string
    const userId = response.locals.user.uid as string

    try {
      await prisma.$transaction([
        prisma.task.updateMany({
          where: { projectId, assigneeId: userId },
          data: { assigneeId: null },
        }),
        prisma.conversationMember.deleteMany({
          where: { userId, conversation: { projectId } },
        }),
        prisma.callRoom.deleteMany({
          where: {
            projectId,
            directKey: { not: null },
            members: { some: { userId } },
          },
        }),
        prisma.callRoomMember.deleteMany({
          where: { userId, room: { projectId } },
        }),
        prisma.projectMember.delete({
          where: { projectId_userId: { projectId, userId } },
        }),
      ])
      response.status(204).send()
    } catch (error) {
      next(error)
    }
  },
)

projectsRouter.get(
  '/:projectId/members',
  requireProjectMember,
  async (request, response, next) => {
    try {
      const members = await prisma.projectMember.findMany({
        where: { projectId: response.locals.projectId as string },
        include: { user: true, role: true },
        orderBy: { joinedAt: 'asc' },
      })

      response.json(members.map(serializeMember))
    } catch (error) {
      next(error)
    }
  },
)

projectsRouter.post(
  '/:projectId/members',
  requireProjectMember,
  async (request, response, next) => {
    if (!response.locals.membership.role.isManager) {
      response.status(403).json({ message: 'Only a manager can add members' })
      return
    }

    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : ''

    if (!email) {
      response.status(400).json({ message: 'A member email is required' })
      return
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } })

      if (!user) {
        response.status(404).json({
          message: 'That user must sign in to Parallel before being added',
        })
        return
      }

      const memberRole = await memberRoleFor(response.locals.projectId as string)

      if (!memberRole) {
        response.status(500).json({ message: 'The Member role is missing' })
        return
      }

      const membership = await prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: response.locals.projectId as string,
            userId: user.id,
          },
        },
        update: {},
        create: {
          projectId: response.locals.projectId as string,
          userId: user.id,
          roleId: memberRole.id,
        },
        include: { user: true, role: true },
      })

      await ensureTeamConversation(response.locals.projectId as string)

      response.status(201).json(serializeMember(membership))
    } catch (error) {
      next(error)
    }
  },
)

projectsRouter.patch(
  '/:projectId/members/:userId',
  requireProjectMember,
  async (request, response, next) => {
    if (!response.locals.membership.role.isManager) {
      response.status(403).json({ message: 'Only a manager can change roles' })
      return
    }

    const userId = request.params.userId
    const roleId = request.body?.roleId

    if (typeof userId !== 'string' || typeof roleId !== 'string') {
      response.status(400).json({ message: 'A member and role are required' })
      return
    }

    const projectId = response.locals.projectId as string

    try {
      const nextRole = await prisma.role.findFirst({
        where: { id: roleId, projectId },
      })

      if (!nextRole) {
        response.status(404).json({ message: 'That role is not part of this project' })
        return
      }

      const current = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        include: { role: true },
      })

      if (!current) {
        response.status(404).json({ message: 'That person is not a project member' })
        return
      }

      if (current.role.isManager && !nextRole.isManager) {
        const managerCount = await prisma.projectMember.count({
          where: { projectId, role: { isManager: true } },
        })

        if (managerCount <= 1) {
          response.status(400).json({
            message: 'Choose another manager before changing the last manager',
          })
          return
        }
      }

      const membership = await prisma.projectMember.update({
        where: { projectId_userId: { projectId, userId } },
        data: { roleId: nextRole.id },
        include: { user: true, role: true },
      })

      response.json(serializeMember(membership))
    } catch (error) {
      next(error)
    }
  },
)

projectsRouter.get(
  '/:projectId/roles',
  requireProjectMember,
  async (_request, response, next) => {
    try {
      const roles = await prisma.role.findMany({
        where: { projectId: response.locals.projectId as string },
        orderBy: [{ isManager: 'desc' }, { name: 'asc' }],
      })

      response.json(
        roles.map((role) => ({
          id: role.id,
          name: role.name,
          isManager: role.isManager,
        })),
      )
    } catch (error) {
      next(error)
    }
  },
)

projectsRouter.post(
  '/:projectId/roles',
  requireProjectMember,
  async (request, response, next) => {
    if (!response.locals.membership.role.isManager) {
      response.status(403).json({ message: 'Only a manager can add roles' })
      return
    }

    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''

    if (!name || name.length > 32) {
      response.status(400).json({ message: 'A role name must be 1 to 32 characters' })
      return
    }

    try {
      const existing = await prisma.role.findFirst({
        where: {
          projectId: response.locals.projectId as string,
          name: { equals: name, mode: 'insensitive' },
        },
      })

      if (existing) {
        response.status(409).json({ message: 'That role already exists' })
        return
      }

      const role = await prisma.role.create({
        data: {
          projectId: response.locals.projectId as string,
          name,
          isManager: false,
        },
      })

      response.status(201).json({
        id: role.id,
        name: role.name,
        isManager: role.isManager,
      })
    } catch (error) {
      next(error)
    }
  },
)
