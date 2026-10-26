import { prisma } from './prisma.js'

const defaultRoles = [
  { name: 'Manager', isManager: true },
  { name: 'Member', isManager: false },
] as const

export async function createManagedProject(input: {
  userId: string
  name: string
  description: string
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: input.name,
        description: input.description,
        roles: { create: [...defaultRoles] },
      },
      include: {
        roles: true,
        _count: { select: { members: true, tasks: true } },
      },
    })
    const managerRole = project.roles.find((role) => role.isManager)

    if (!managerRole) {
      throw new Error('Manager role was not created')
    }

    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: input.userId,
        roleId: managerRole.id,
      },
    })

    await tx.conversation.create({
      data: {
        projectId: project.id,
        name: 'Team',
        kind: 'TEAM',
        members: { create: { userId: input.userId } },
      },
    })

    return { project, managerRole }
  })
}

export async function memberRoleFor(projectId: string) {
  return prisma.role.findFirst({
    where: { projectId, isManager: false, name: 'Member' },
  })
}
