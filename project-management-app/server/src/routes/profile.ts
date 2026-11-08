import express, { Router } from 'express'
import { imageType } from '../lib/images.js'
import { prisma } from '../lib/prisma.js'
import { serializeUser } from '../lib/users.js'

export const profileRouter = Router()

function profileResponse(user: {
  id: string
  email: string
  displayName: string | null
  photoUrl: string | null
  photoUpdatedAt: Date | null
}) {
  const serialized = serializeUser(user)
  return {
    uid: serialized.id,
    email: serialized.email,
    displayName: serialized.displayName,
    photoUrl: serialized.photoUrl,
  }
}

profileRouter.get('/', async (_request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: response.locals.user.uid as string },
    })

    if (!user) {
      response.status(404).json({ message: 'Profile not found' })
      return
    }

    response.json(profileResponse(user))
  } catch (error) {
    next(error)
  }
})

profileRouter.patch('/', async (request, response, next) => {
  const displayName =
    typeof request.body?.displayName === 'string' ? request.body.displayName.trim() : ''

  if (!displayName || displayName.length > 40) {
    response.status(400).json({ message: 'A display name must be 1 to 40 characters' })
    return
  }

  try {
    const user = await prisma.user.update({
      where: { id: response.locals.user.uid as string },
      data: { displayName },
    })

    response.json(profileResponse(user))
  } catch (error) {
    next(error)
  }
})

profileRouter.post(
  '/photo',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    limit: '2mb',
  }),
  async (request, response, next) => {
    const bytes = Buffer.isBuffer(request.body) ? request.body : null
    const contentType = bytes ? imageType(bytes) : null

    if (!bytes || !contentType) {
      response.status(400).json({ message: 'Photo must be a JPEG, PNG, WebP, or GIF' })
      return
    }

    const userId = response.locals.user.uid as string
    const photoUpdatedAt = new Date()

    try {
      const user = await prisma.$transaction(async (tx) => {
        await tx.userPhoto.upsert({
          where: { userId },
          create: { userId, data: bytes, contentType },
          update: { data: bytes, contentType },
        })
        return tx.user.update({
          where: { id: userId },
          data: { photoUpdatedAt, photoUrl: null },
        })
      })

      response.json(profileResponse(user))
    } catch (error) {
      next(error)
    }
  },
)

profileRouter.delete('/photo', async (_request, response, next) => {
  const userId = response.locals.user.uid as string

  try {
    const user = await prisma.$transaction(async (tx) => {
      await tx.userPhoto.deleteMany({ where: { userId } })
      return tx.user.update({
        where: { id: userId },
        data: { photoUpdatedAt: null, photoUrl: null },
      })
    })

    response.json(profileResponse(user))
  } catch (error) {
    next(error)
  }
})
