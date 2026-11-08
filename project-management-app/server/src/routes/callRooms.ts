import { Router } from 'express'
import {
  createCallRoom,
  listCallRooms,
  serializeCallRoom,
} from '../lib/callRooms.js'
import { notifyUsers } from '../lib/notifications.js'

export const callRoomsRouter = Router({ mergeParams: true })

callRoomsRouter.get('/', async (_request, response, next) => {
  try {
    const projectId = response.locals.projectId as string
    const userId = response.locals.user.uid as string
    const rooms = await listCallRooms(projectId, userId)

    response.json(rooms.map((room) => serializeCallRoom(room, userId)))
  } catch (error) {
    next(error)
  }
})

callRoomsRouter.post('/', async (request, response, next) => {
  const memberIds = Array.isArray(request.body?.memberIds)
    ? request.body.memberIds.filter((id: unknown): id is string => typeof id === 'string')
    : []
  const name = typeof request.body?.name === 'string' ? request.body.name : undefined

  try {
    const result = await createCallRoom({
      projectId: response.locals.projectId as string,
      creatorId: response.locals.user.uid as string,
      memberIds,
      ...(name !== undefined ? { name } : {}),
    })

    if ('error' in result) {
      response.status(400).json({ message: result.error })
      return
    }

    if (result.created) {
      await notifyUsers({
        recipientIds: result.room.members.map((member) => member.userId),
        actorId: response.locals.user.uid as string,
        projectId: response.locals.projectId as string,
        kind: 'CALL_INVITE',
        subject: result.room.name || 'Call',
        callRoomId: result.room.id,
      })
    }

    response
      .status(result.created ? 201 : 200)
      .json(
        serializeCallRoom(result.room, response.locals.user.uid as string),
      )
  } catch (error) {
    next(error)
  }
})
