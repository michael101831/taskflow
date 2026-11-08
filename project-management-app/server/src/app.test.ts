import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

vi.mock('./lib/firebaseAdmin.js', () => ({
  adminAuth: {
    verifyIdToken: async (token: string) => {
      const users = {
        'owner-token': {
          uid: 'integration-owner',
          email: 'owner@taskflow.test',
          name: 'Owner',
        },
        'outsider-token': {
          uid: 'integration-outsider',
          email: 'outsider@taskflow.test',
          name: 'Outsider',
        },
        'guest-token': {
          uid: 'integration-guest',
          email: 'guest@taskflow.test',
          name: 'Guest',
        },
      } as const
      const user = users[token as keyof typeof users]

      if (!user) throw new Error('Invalid test token')
      return user
    },
  },
}))

const { createApp } = await import('./app.js')
const { prisma } = await import('./lib/prisma.js')

const app = createApp()
const testUserIds = ['integration-owner', 'integration-outsider']

async function removeTestData() {
  await prisma.project.deleteMany({
    where: {
      members: { some: { userId: { in: testUserIds } } },
      id: { not: 'portfolio-launch' },
    },
  })
  await prisma.projectMember.deleteMany({
    where: { userId: { in: testUserIds } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: testUserIds } },
  })
}

describe('project and task API', () => {
  beforeAll(async () => {
    await removeTestData()
    await prisma.user.createMany({
      data: [
        {
          id: 'integration-owner',
          email: 'owner@taskflow.test',
          displayName: 'Owner',
        },
        {
          id: 'integration-outsider',
          email: 'outsider@taskflow.test',
          displayName: 'Outsider',
        },
      ],
    })
    const anchor = await prisma.project.create({
      data: {
        name: 'Integration membership anchor',
        description: 'Keeps test users away from the starter project.',
        roles: {
          create: [
            { name: 'Manager', isManager: true },
            { name: 'Member', isManager: false },
          ],
        },
      },
      include: { roles: true },
    })
    const managerRole = anchor.roles.find((role) => role.isManager)

    await prisma.projectMember.createMany({
      data: testUserIds.map((userId) => ({
        projectId: anchor.id,
        userId,
        roleId: managerRole?.id ?? '',
      })),
    })
  })

  afterAll(async () => {
    await removeTestData()
    await prisma.$disconnect()
  })

  it('rejects anonymous access to projects', async () => {
    const response = await request(app).get('/api/projects')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ message: 'Authentication required' })
  })

  it('creates a project, assigns a task, and hides it from other users', async () => {
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer owner-token')
      .send({
        name: 'Integration Events',
        description: 'Temporary project used by the API test.',
      })

    expect(projectResponse.status).toBe(201)
    expect(projectResponse.body).toMatchObject({
      name: 'Integration Events',
      role: 'Manager',
      canManage: true,
      taskCounts: { todo: 0, 'in-progress': 0, done: 0 },
    })

    const projectId = projectResponse.body.id as string
    const taskResponse = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        title: 'Research events API',
        description: 'Compare providers.',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-11-02',
        assigneeId: 'integration-owner',
      })

    expect(taskResponse.status).toBe(201)
    expect(taskResponse.body).toMatchObject({
      title: 'Research events API',
      status: 'todo',
      assignee: { id: 'integration-owner' },
    })

    const movedResponse = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskResponse.body.id}`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        ...taskResponse.body,
        status: 'done',
        assigneeId: 'integration-owner',
      })

    expect(movedResponse.status).toBe(200)
    expect(movedResponse.body.status).toBe('done')

    const outsiderResponse = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer outsider-token')

    expect(outsiderResponse.status).toBe(403)

    const savedTasks = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer owner-token')

    expect(savedTasks.body).toEqual([
      expect.objectContaining({
        title: 'Research events API',
        status: 'done',
      }),
    ])

    const sooner = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        title: 'Book the venue',
        description: 'Hold a date.',
        status: 'todo',
        priority: 'medium',
        dueDate: '2026-10-01',
        assigneeId: 'integration-owner',
      })

    expect(sooner.status).toBe(201)

    const mine = await request(app)
      .get('/api/tasks/mine')
      .set('Authorization', 'Bearer owner-token')

    expect(mine.status).toBe(200)
    expect(
      mine.body
        .filter((task: { projectId: string }) => task.projectId === projectId)
        .map((task: { title: string }) => task.title),
    ).toEqual(['Book the venue', 'Research events API'])
    expect(mine.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Book the venue',
          projectId,
          projectName: 'Integration Events',
        }),
      ]),
    )

    const outsiderMine = await request(app)
      .get('/api/tasks/mine')
      .set('Authorization', 'Bearer outsider-token')

    expect(outsiderMine.status).toBe(200)
    expect(outsiderMine.body.map((task: { id: number }) => task.id)).not.toContain(
      taskResponse.body.id,
    )

    const unauthenticatedMine = await request(app).get('/api/tasks/mine')
    expect(unauthenticatedMine.status).toBe(401)

    const listedProjects = await request(app)
      .get('/api/projects')
      .set('Authorization', 'Bearer owner-token')

    expect(listedProjects.status).toBe(200)
    expect(listedProjects.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: projectId,
          taskCounts: { todo: 1, 'in-progress': 0, done: 1 },
        }),
      ]),
    )
  }, 20000)

  it('records project activity and task comments', async () => {
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Integration History', description: 'Activity and comments.' })

    const projectId = projectResponse.body.id as string

    const hidden = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Authorization', 'Bearer outsider-token')

    expect(hidden.status).toBe(403)

    const taskResponse = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        title: 'Research events API',
        description: 'Compare providers.',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-11-02',
        assigneeId: 'integration-owner',
      })

    await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskResponse.body.id}`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        ...taskResponse.body,
        status: 'in-progress',
        assigneeId: 'integration-owner',
      })

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({ email: 'outsider@taskflow.test' })

    await request(app)
      .post(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')
      .send({ kind: 'group', name: 'Notes', memberIds: ['integration-outsider'] })

    const activity = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Authorization', 'Bearer owner-token')

    expect(activity.status).toBe(200)
    expect(activity.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'chat-created',
          subject: 'Team',
          detail: 'team',
          actor: expect.objectContaining({ id: 'integration-owner' }),
        }),
        expect.objectContaining({ kind: 'task-created', subject: 'Research events API' }),
        expect.objectContaining({
          kind: 'task-moved',
          subject: 'Research events API',
          detail: 'To do to In progress',
        }),
        expect.objectContaining({ kind: 'member-added', subject: 'Outsider' }),
        expect.objectContaining({
          kind: 'chat-created',
          subject: 'Notes',
          detail: 'group',
        }),
      ]),
    )

    const comment = await request(app)
      .post(`/api/projects/${projectId}/tasks/${taskResponse.body.id}/comments`)
      .set('Authorization', 'Bearer owner-token')
      .send({ body: 'Looks good' })

    expect(comment.status).toBe(201)
    expect(comment.body).toMatchObject({
      body: 'Looks good',
      author: { id: 'integration-owner' },
    })

    const comments = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskResponse.body.id}/comments`)
      .set('Authorization', 'Bearer outsider-token')

    expect(comments.status).toBe(200)
    expect(comments.body).toEqual([
      expect.objectContaining({ body: 'Looks good' }),
    ])

    const forbiddenDelete = await request(app)
      .delete(
        `/api/projects/${projectId}/tasks/${taskResponse.body.id}/comments/${comment.body.id}`,
      )
      .set('Authorization', 'Bearer outsider-token')

    expect(forbiddenDelete.status).toBe(403)

    const deleted = await request(app)
      .delete(
        `/api/projects/${projectId}/tasks/${taskResponse.body.id}/comments/${comment.body.id}`,
      )
      .set('Authorization', 'Bearer owner-token')

    expect(deleted.status).toBe(204)
  }, 20000)

  it('saves a profile and notifies people about assignments, messages, and calls', async () => {
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Integration Alerts', description: 'Profiles and notifications.' })

    const projectId = projectResponse.body.id as string

    const savedProfile = await request(app)
      .patch('/api/profile')
      .set('Authorization', 'Bearer owner-token')
      .send({ displayName: 'Alex' })

    expect(savedProfile.status).toBe(200)
    expect(savedProfile.body).toMatchObject({
      uid: 'integration-owner',
      displayName: 'Alex',
      photoUrl: null,
    })

    const invalidPhoto = await request(app)
      .post('/api/profile/photo')
      .set('Authorization', 'Bearer owner-token')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('not-an-image'))

    expect(invalidPhoto.status).toBe(400)

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const uploaded = await request(app)
      .post('/api/profile/photo')
      .set('Authorization', 'Bearer owner-token')
      .set('Content-Type', 'image/png')
      .send(png)

    expect(uploaded.status).toBe(200)
    expect(uploaded.body.photoUrl).toMatch(/^\/api\/avatars\/integration-owner\?v=\d+$/)

    const image = await request(app).get(uploaded.body.photoUrl as string)
    expect(image.status).toBe(200)
    expect(image.headers['content-type']).toBe('image/png')
    expect(image.body).toEqual(png)

    const profile = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer owner-token')

    expect(profile.body.displayName).toBe('Alex')

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({ email: 'outsider@taskflow.test' })

    const assigned = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        title: 'Send the invite',
        description: 'Tell the team.',
        status: 'todo',
        priority: 'medium',
        dueDate: '2026-12-01',
        assigneeId: 'integration-outsider',
      })

    expect(assigned.status).toBe(201)

    const ownerFeed = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer owner-token')

    expect(ownerFeed.body.unreadCount).toBe(0)

    const outsiderFeed = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer outsider-token')

    expect(outsiderFeed.status).toBe(200)
    expect(outsiderFeed.body.unreadCount).toBe(1)
    expect(outsiderFeed.body.items[0]).toMatchObject({
      kind: 'task-assigned',
      subject: 'Send the invite',
      projectId,
      actor: {
        displayName: 'Alex',
        photoUrl: expect.stringMatching(/^\/api\/avatars\/integration-owner\?v=\d+$/),
      },
    })

    const conversations = await request(app)
      .get(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')
    const team = conversations.body.find(
      (conversation: { kind: string }) => conversation.kind === 'team',
    )

    await request(app)
      .post(`/api/projects/${projectId}/conversations/${team.id}/messages`)
      .set('Authorization', 'Bearer owner-token')
      .send({ body: 'The invite is ready.' })

    const room = await request(app)
      .post(`/api/projects/${projectId}/call-rooms`)
      .set('Authorization', 'Bearer owner-token')
      .send({ memberIds: ['integration-outsider'], name: 'Launch call' })

    expect(room.status).toBe(201)

    const updatedFeed = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer outsider-token')

    expect(updatedFeed.body.items.map((item: { kind: string }) => item.kind)).toEqual([
      'call-invite',
      'message',
      'task-assigned',
    ])

    const marked = await request(app)
      .post(`/api/notifications/${updatedFeed.body.items[0].id}/read`)
      .set('Authorization', 'Bearer outsider-token')

    expect(marked.status).toBe(204)

    const hidden = await request(app)
      .post(`/api/notifications/${updatedFeed.body.items[1].id}/read`)
      .set('Authorization', 'Bearer owner-token')

    expect(hidden.status).toBe(404)

    const allRead = await request(app)
      .post('/api/notifications/read')
      .set('Authorization', 'Bearer outsider-token')

    expect(allRead.status).toBe(204)

    const cleared = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer outsider-token')

    expect(cleared.body.unreadCount).toBe(0)

    const removed = await request(app)
      .delete('/api/profile/photo')
      .set('Authorization', 'Bearer owner-token')

    expect(removed.status).toBe(200)
    expect(removed.body.photoUrl).toBeNull()

    const gone = await request(app).get(uploaded.body.photoUrl as string)
    expect(gone.status).toBe(404)
  }, 20000)

  it('lets members bookmark a project and exchange messages', async () => {
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Integration Chat', description: 'Messages test.' })

    const projectId = projectResponse.body.id as string

    const bookmarkResponse = await request(app)
      .patch(`/api/projects/${projectId}/bookmark`)
      .set('Authorization', 'Bearer owner-token')
      .send({ bookmarked: true })

    expect(bookmarkResponse.status).toBe(200)
    expect(bookmarkResponse.body.bookmarked).toBe(true)

    const chats = await request(app)
      .get(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')

    expect(chats.status).toBe(200)
    expect(chats.body).toEqual([
      expect.objectContaining({ name: 'Team', kind: 'team' }),
    ])

    const conversationId = chats.body[0].id as string
    const outsiderMessages = await request(app)
      .get(`/api/projects/${projectId}/conversations/${conversationId}/messages`)
      .set('Authorization', 'Bearer outsider-token')

    expect(outsiderMessages.status).toBe(403)

    const createdMessage = await request(app)
      .post(`/api/projects/${projectId}/conversations/${conversationId}/messages`)
      .set('Authorization', 'Bearer owner-token')
      .send({ body: 'Ready for review' })

    expect(createdMessage.status).toBe(201)
    expect(createdMessage.body).toMatchObject({
      body: 'Ready for review',
      author: { id: 'integration-owner', role: 'Manager' },
    })

    const messages = await request(app)
      .get(`/api/projects/${projectId}/conversations/${conversationId}/messages`)
      .set('Authorization', 'Bearer owner-token')

    expect(messages.body).toEqual([
      expect.objectContaining({ body: 'Ready for review' }),
    ])

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({ email: 'outsider@taskflow.test' })

    const forbiddenDelete = await request(app)
      .delete(
        `/api/projects/${projectId}/conversations/${conversationId}/messages/${createdMessage.body.id}`,
      )
      .set('Authorization', 'Bearer outsider-token')

    expect(forbiddenDelete.status).toBe(403)

    const deletedMessage = await request(app)
      .delete(
        `/api/projects/${projectId}/conversations/${conversationId}/messages/${createdMessage.body.id}`,
      )
      .set('Authorization', 'Bearer owner-token')

    expect(deletedMessage.status).toBe(204)

    const blockedProjectGroup = await request(app)
      .post(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer outsider-token')
      .send({ kind: 'group', name: 'Everyone', wholeProject: true })

    expect(blockedProjectGroup.status).toBe(403)

    const projectGroup = await request(app)
      .post(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')
      .send({ kind: 'group', name: 'Everyone', wholeProject: true })

    expect(projectGroup.status).toBe(201)
    expect(projectGroup.body.members).toHaveLength(2)

    const direct = await request(app)
      .post(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')
      .send({ kind: 'direct', memberIds: ['integration-outsider'] })

    expect(direct.status).toBe(201)
    expect(direct.body).toMatchObject({
      kind: 'direct',
      name: 'Outsider',
    })

    const repeatedDirect = await request(app)
      .post(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')
      .send({ kind: 'direct', memberIds: ['integration-outsider'] })

    expect(repeatedDirect.status).toBe(200)
    expect(repeatedDirect.body.id).toBe(direct.body.id)

    const group = await request(app)
      .post(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')
      .send({
        kind: 'group',
        name: 'Review',
        memberIds: ['integration-outsider'],
      })

    expect(group.status).toBe(201)
    expect(group.body).toMatchObject({ kind: 'group', name: 'Review' })

    const visibleToMember = await request(app)
      .get(`/api/projects/${projectId}/conversations/${group.body.id}/messages`)
      .set('Authorization', 'Bearer outsider-token')

    expect(visibleToMember.status).toBe(200)

    const missingChat = await request(app)
      .get(`/api/projects/${projectId}/conversations/missing-chat/messages`)
      .set('Authorization', 'Bearer outsider-token')

    expect(missingChat.status).toBe(404)

    const leftDirect = await request(app)
      .delete(`/api/projects/${projectId}/conversations/${direct.body.id}`)
      .set('Authorization', 'Bearer outsider-token')

    expect(leftDirect.status).toBe(200)
    expect(leftDirect.body).toEqual({ action: 'left' })

    const outsiderAfterLeave = await request(app)
      .get(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer outsider-token')

    expect(outsiderAfterLeave.body.map((chat: { id: string }) => chat.id)).not.toContain(
      direct.body.id,
    )

    const rejoinedDirect = await request(app)
      .post(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer outsider-token')
      .send({ kind: 'direct', memberIds: ['integration-owner'] })

    expect(rejoinedDirect.status).toBe(200)
    expect(rejoinedDirect.body.id).toBe(direct.body.id)
    expect(rejoinedDirect.body.members).toHaveLength(2)

    const ownerLeavesDirect = await request(app)
      .delete(`/api/projects/${projectId}/conversations/${direct.body.id}`)
      .set('Authorization', 'Bearer owner-token')

    expect(ownerLeavesDirect.body).toEqual({ action: 'left' })

    const deletedDirect = await request(app)
      .delete(`/api/projects/${projectId}/conversations/${direct.body.id}`)
      .set('Authorization', 'Bearer outsider-token')

    expect(deletedDirect.body).toEqual({ action: 'deleted' })

    const deletedAgain = await request(app)
      .delete(`/api/projects/${projectId}/conversations/${direct.body.id}`)
      .set('Authorization', 'Bearer outsider-token')

    expect(deletedAgain.status).toBe(404)

    const leftGroup = await request(app)
      .delete(`/api/projects/${projectId}/conversations/${group.body.id}`)
      .set('Authorization', 'Bearer outsider-token')

    expect(leftGroup.body).toEqual({ action: 'left' })

    const deletedGroup = await request(app)
      .delete(`/api/projects/${projectId}/conversations/${group.body.id}`)
      .set('Authorization', 'Bearer owner-token')

    expect(deletedGroup.body).toEqual({ action: 'deleted' })

    const leftTeam = await request(app)
      .delete(`/api/projects/${projectId}/conversations/${conversationId}`)
      .set('Authorization', 'Bearer outsider-token')

    expect(leftTeam.body).toEqual({ action: 'left' })

    const ownerChats = await request(app)
      .get(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')

    expect(ownerChats.body.map((chat: { id: string }) => chat.id)).toContain(conversationId)

    const outsiderChats = await request(app)
      .get(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer outsider-token')

    expect(outsiderChats.body.map((chat: { id: string }) => chat.id)).not.toContain(
      conversationId,
    )

    const deletedTeam = await request(app)
      .delete(`/api/projects/${projectId}/conversations/${conversationId}`)
      .set('Authorization', 'Bearer owner-token')

    expect(deletedTeam.body).toEqual({ action: 'deleted' })

    const afterTeamDelete = await request(app)
      .get(`/api/projects/${projectId}/conversations`)
      .set('Authorization', 'Bearer owner-token')

    expect(afterTeamDelete.body.map((chat: { id: string }) => chat.id)).not.toContain(
      conversationId,
    )
  }, 20000)

  it('lets a member leave and lets the manager delete the project', async () => {
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Integration Departure', description: 'Leave and delete test.' })

    const projectId = projectResponse.body.id as string

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({ email: 'outsider@taskflow.test' })

    const managerLeaves = await request(app)
      .delete(`/api/projects/${projectId}/members/me`)
      .set('Authorization', 'Bearer owner-token')

    expect(managerLeaves.status).toBe(403)

    const memberLeaves = await request(app)
      .delete(`/api/projects/${projectId}/members/me`)
      .set('Authorization', 'Bearer outsider-token')

    expect(memberLeaves.status).toBe(204)

    const afterLeaving = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer outsider-token')

    expect(afterLeaving.status).toBe(403)

    const memberDeletes = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', 'Bearer outsider-token')

    expect(memberDeletes.status).toBe(403)

    const managerDeletes = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', 'Bearer owner-token')

    expect(managerDeletes.status).toBe(204)
  })

  it('lets a manager add a role and assign the manager role', async () => {
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Integration Roles', description: 'Role management test.' })

    const projectId = projectResponse.body.id as string

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({ email: 'outsider@taskflow.test' })

    const roleResponse = await request(app)
      .post(`/api/projects/${projectId}/roles`)
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Designer' })

    expect(roleResponse.status).toBe(201)
    expect(roleResponse.body).toMatchObject({ name: 'Designer', isManager: false })

    const changed = await request(app)
      .patch(`/api/projects/${projectId}/members/integration-outsider`)
      .set('Authorization', 'Bearer owner-token')
      .send({ roleId: roleResponse.body.id })

    expect(changed.status).toBe(200)
    expect(changed.body).toMatchObject({
      id: 'integration-outsider',
      role: 'Designer',
      canManage: false,
    })

    const roles = await request(app)
      .get(`/api/projects/${projectId}/roles`)
      .set('Authorization', 'Bearer owner-token')

    const managerRole = roles.body.find(
      (role: { isManager: boolean }) => role.isManager,
    )

    const promoted = await request(app)
      .patch(`/api/projects/${projectId}/members/integration-outsider`)
      .set('Authorization', 'Bearer owner-token')
      .send({ roleId: managerRole.id })

    expect(promoted.status).toBe(200)
    expect(promoted.body.canManage).toBe(true)
  })

  it('hides a call room from people who were not invited', async () => {
    await prisma.user.upsert({
      where: { id: 'integration-guest' },
      update: {},
      create: {
        id: 'integration-guest',
        email: 'guest@taskflow.test',
        displayName: 'Guest',
      },
    })

    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Integration Calls', description: 'Private call rooms.' })

    const projectId = projectResponse.body.id as string

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({ email: 'outsider@taskflow.test' })

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', 'Bearer owner-token')
      .send({ email: 'guest@taskflow.test' })

    const created = await request(app)
      .post(`/api/projects/${projectId}/call-rooms`)
      .set('Authorization', 'Bearer owner-token')
      .send({ memberIds: ['integration-outsider'] })

    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: 'Outsider', kind: 'direct' })

    const guestRooms = await request(app)
      .get(`/api/projects/${projectId}/call-rooms`)
      .set('Authorization', 'Bearer guest-token')

    const outsiderRooms = await request(app)
      .get(`/api/projects/${projectId}/call-rooms`)
      .set('Authorization', 'Bearer outsider-token')

    expect(guestRooms.status).toBe(200)
    expect(guestRooms.body).toEqual([])
    expect(outsiderRooms.body).toEqual([
      expect.objectContaining({ id: created.body.id, name: 'Owner', kind: 'direct' }),
    ])

    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: 'integration-guest' } })
  })
})
