import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

export const avatarsRouter = Router()

avatarsRouter.get('/:userId', async (request, response, next) => {
  const userId = request.params.userId

  if (!userId || Array.isArray(userId)) {
    response.status(404).json({ message: 'Photo not found' })
    return
  }

  try {
    const photo = await prisma.userPhoto.findUnique({ where: { userId } })

    if (!photo) {
      response.status(404).json({ message: 'Photo not found' })
      return
    }

    response.setHeader('Content-Type', photo.contentType)
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.send(Buffer.from(photo.data))
  } catch (error) {
    next(error)
  }
})
