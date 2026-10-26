import 'dotenv/config'
import { prisma } from './lib/prisma.js'

const projectId = 'portfolio-launch'

async function seed() {
  await prisma.project.upsert({
    where: { id: projectId },
    update: {},
    create: {
      id: projectId,
      name: 'Portfolio Launch',
      description: 'Plan and publish a polished developer portfolio.',
    },
  })

  const taskCount = await prisma.task.count({
    where: { projectId },
  })

  if (taskCount === 0) {
    await prisma.task.createMany({
      data: [
        {
          title: 'Create project wireframes',
          description: 'Sketch the dashboard and board views.',
          status: 'DONE',
          priority: 'HIGH',
          dueDate: new Date('2026-10-08T00:00:00.000Z'),
          projectId,
        },
        {
          title: 'Build navigation',
          description: 'Add the sidebar and responsive mobile menu.',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
          dueDate: new Date('2026-10-12T00:00:00.000Z'),
          projectId,
        },
        {
          title: 'Set up authentication',
          description: 'Connect Firebase Authentication.',
          status: 'TODO',
          priority: 'HIGH',
          dueDate: new Date('2026-10-15T00:00:00.000Z'),
          projectId,
        },
        {
          title: 'Design empty states',
          description: 'Guide users when projects contain no tasks.',
          status: 'TODO',
          priority: 'LOW',
          dueDate: new Date('2026-10-18T00:00:00.000Z'),
          projectId,
        },
      ],
    })
  }
}

seed()
  .then(() => console.log('Database seeded'))
  .finally(() => prisma.$disconnect())
