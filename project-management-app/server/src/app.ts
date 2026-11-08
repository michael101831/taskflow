import 'dotenv/config'
import cors from 'cors'
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { prisma } from './lib/prisma.js'
import { requireAuth } from './middleware/requireAuth.js'
import { requireProjectMember } from './middleware/requireProjectMember.js'
import { activityRouter } from './routes/activity.js'
import { avatarsRouter } from './routes/avatars.js'
import { callRoomsRouter } from './routes/callRooms.js'
import { conversationsRouter } from './routes/conversations.js'
import { myTasksRouter } from './routes/myTasks.js'
import { notificationsRouter } from './routes/notifications.js'
import { profileRouter } from './routes/profile.js'
import { projectsRouter } from './routes/projects.js'
import { tasksRouter } from './routes/tasks.js'

export function createApp() {
  const app = express()

  const allowedOrigins = process.env.CLIENT_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.use(cors(allowedOrigins?.length ? { origin: allowedOrigins } : undefined))
  app.use(express.json())

  app.get('/api/health', async (_request, response) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      response.json({
        message: 'Project management API and database are connected',
        status: 'ok',
      })
    } catch {
      response.status(503).json({
        message: 'Database unavailable',
        status: 'error',
      })
    }
  })

  app.use('/api/avatars', avatarsRouter)

  app.get('/api/session', requireAuth, (_request, response) => {
    response.json(response.locals.user)
  })

  app.use('/api/profile', requireAuth, profileRouter)
  app.use('/api/notifications', requireAuth, notificationsRouter)
  app.use('/api/tasks', requireAuth, myTasksRouter)
  app.use(
    '/api/projects/:projectId/activity',
    requireAuth,
    requireProjectMember,
    activityRouter,
  )
  app.use(
    '/api/projects/:projectId/tasks',
    requireAuth,
    requireProjectMember,
    tasksRouter,
  )
  app.use(
    '/api/projects/:projectId/conversations',
    requireAuth,
    requireProjectMember,
    conversationsRouter,
  )
  app.use(
    '/api/projects/:projectId/call-rooms',
    requireAuth,
    requireProjectMember,
    callRoomsRouter,
  )
  app.use('/api/projects', requireAuth, projectsRouter)

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      console.error(error)

      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        response.status(404).json({ message: 'Task not found' })
        return
      }

      response.status(500).json({ message: 'Unexpected server error' })
    },
  )

  return app
}
