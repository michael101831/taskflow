import type {
  ActivityEvent,
  AssignedTask,
  CallRoom,
  Conversation,
  Message,
  NotificationFeed,
  Profile,
  ProfilePhotoUpdate,
  Project,
  ProjectMember,
  ProjectRole,
  Task,
  TaskComment,
  TaskInput,
} from '../types'
import { auth } from '../lib/firebase'

const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export function apiUrl(path: string) {
  return `${apiBase}${path}`
}

export function callSocketUrl() {
  if (apiBase) {
    const url = new URL(apiBase)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/call'
    url.search = ''
    url.hash = ''
    return url.toString()
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/call`
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken()

  if (!token) {
    throw new Error('Authentication required')
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string
    } | null
    throw new Error(
      errorBody?.message ?? `Request failed with status ${response.status}`,
    )
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const tasksApi = {
  list: (projectId: string) =>
    request<Task[]>(apiUrl(`/api/projects/${projectId}/tasks`)),

  mine: () => request<AssignedTask[]>(apiUrl('/api/tasks/mine')),

  create: (projectId: string, task: TaskInput) =>
    request<Task>(apiUrl(`/api/projects/${projectId}/tasks`), {
      method: 'POST',
      body: JSON.stringify(task),
    }),

  update: (projectId: string, id: number, task: TaskInput) =>
    request<Task>(apiUrl(`/api/projects/${projectId}/tasks/${id}`), {
      method: 'PUT',
      body: JSON.stringify(task),
    }),

  remove: (projectId: string, id: number) =>
    request<void>(apiUrl(`/api/projects/${projectId}/tasks/${id}`), {
      method: 'DELETE',
    }),

  listComments: (projectId: string, taskId: number) =>
    request<TaskComment[]>(
      apiUrl(`/api/projects/${projectId}/tasks/${taskId}/comments`),
    ),

  createComment: (projectId: string, taskId: number, body: string) =>
    request<TaskComment>(
      apiUrl(`/api/projects/${projectId}/tasks/${taskId}/comments`),
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      },
    ),

  removeComment: (projectId: string, taskId: number, commentId: string) =>
    request<void>(
      apiUrl(`/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`),
      { method: 'DELETE' },
    ),
}

export const profileApi = {
  get: () => request<Profile>(apiUrl('/api/profile')),

  update: (input: { displayName: string }) =>
    request<Profile>(apiUrl('/api/profile'), {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  uploadPhoto: (file: Blob) =>
    request<Profile>(apiUrl('/api/profile/photo'), {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': file.type || 'image/jpeg' },
    }),

  removePhoto: () =>
    request<Profile>(apiUrl('/api/profile/photo'), { method: 'DELETE' }),

  save: async (input: { displayName: string; photo: ProfilePhotoUpdate }) => {
    let saved = await profileApi.update({ displayName: input.displayName })
    if (input.photo.action === 'remove') saved = await profileApi.removePhoto()
    if (input.photo.action === 'upload') saved = await profileApi.uploadPhoto(input.photo.file)
    return saved
  },
}

export const notificationsApi = {
  list: () => request<NotificationFeed>(apiUrl('/api/notifications')),

  markRead: (id: string) =>
    request<void>(apiUrl(`/api/notifications/${id}/read`), { method: 'POST' }),

  markAllRead: () =>
    request<void>(apiUrl('/api/notifications/read'), { method: 'POST' }),
}

export const callsApi = {
  list: (projectId: string) =>
    request<CallRoom[]>(apiUrl(`/api/projects/${projectId}/call-rooms`)),

  create: (projectId: string, input: { memberIds: string[]; name?: string }) =>
    request<CallRoom>(apiUrl(`/api/projects/${projectId}/call-rooms`), {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}

export const activityApi = {
  list: (projectId: string) =>
    request<ActivityEvent[]>(apiUrl(`/api/projects/${projectId}/activity`)),
}

export const projectsApi = {
  list: () => request<Project[]>(apiUrl('/api/projects')),

  create: (input: { name: string; description: string }) =>
    request<Project>(apiUrl('/api/projects'), {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listMembers: (projectId: string) =>
    request<ProjectMember[]>(apiUrl(`/api/projects/${projectId}/members`)),

  addMember: (projectId: string, email: string) =>
    request<ProjectMember>(apiUrl(`/api/projects/${projectId}/members`), {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  setBookmark: (projectId: string, bookmarked: boolean) =>
    request<Project>(apiUrl(`/api/projects/${projectId}/bookmark`), {
      method: 'PATCH',
      body: JSON.stringify({ bookmarked }),
    }),

  leave: (projectId: string) =>
    request<void>(apiUrl(`/api/projects/${projectId}/members/me`), {
      method: 'DELETE',
    }),

  remove: (projectId: string) =>
    request<void>(apiUrl(`/api/projects/${projectId}`), {
      method: 'DELETE',
    }),

  listRoles: (projectId: string) =>
    request<ProjectRole[]>(apiUrl(`/api/projects/${projectId}/roles`)),

  createRole: (projectId: string, name: string) =>
    request<ProjectRole>(apiUrl(`/api/projects/${projectId}/roles`), {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  changeRole: (projectId: string, userId: string, roleId: string) =>
    request<ProjectMember>(apiUrl(`/api/projects/${projectId}/members/${userId}`), {
      method: 'PATCH',
      body: JSON.stringify({ roleId }),
    }),
}

export const messagesApi = {
  listConversations: (projectId: string) =>
    request<Conversation[]>(apiUrl(`/api/projects/${projectId}/conversations`)),

  createConversation: (
    projectId: string,
    input: {
      kind: 'direct' | 'group'
      name?: string
      memberIds?: string[]
      wholeProject?: boolean
    },
  ) =>
    request<Conversation>(apiUrl(`/api/projects/${projectId}/conversations`), {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  leave: (projectId: string, conversationId: string) =>
    request<{ action: 'left' | 'deleted' }>(
      apiUrl(`/api/projects/${projectId}/conversations/${conversationId}`),
      { method: 'DELETE' },
    ),

  remove: (projectId: string, conversationId: string, messageId: string) =>
    request<void>(
      apiUrl(
        `/api/projects/${projectId}/conversations/${conversationId}/messages/${messageId}`,
      ),
      { method: 'DELETE' },
    ),

  list: (projectId: string, conversationId: string) =>
    request<Message[]>(
      apiUrl(`/api/projects/${projectId}/conversations/${conversationId}/messages`),
    ),

  create: (projectId: string, conversationId: string, body: string) =>
    request<Message>(
      apiUrl(`/api/projects/${projectId}/conversations/${conversationId}/messages`),
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      },
    ),
}
