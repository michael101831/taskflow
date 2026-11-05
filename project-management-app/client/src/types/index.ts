export type TaskStatus = 'todo' | 'in-progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface UserSummary {
  id: string
  email: string
  displayName: string | null
}

export interface Task {
  id: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  assignee: UserSummary | null
}

export interface AssignedTask extends Task {
  projectId: string
  projectName: string
}

export type TaskInput = Omit<Task, 'id' | 'assignee'> & {
  assigneeId: string | null
}

export interface TaskCounts {
  todo: number
  'in-progress': number
  done: number
}

export interface Project {
  id: string
  name: string
  description: string
  role: string
  canManage: boolean
  bookmarked: boolean
  updatedAt: string
  memberCount: number
  taskCount: number
  taskCounts: TaskCounts
}

export interface ProjectRole {
  id: string
  name: string
  isManager: boolean
}

export interface CallRoom {
  id: string
  name: string
  kind: 'direct' | 'group'
  members: UserSummary[]
}

export interface Conversation {
  id: string
  name: string
  kind: 'team' | 'group' | 'direct'
  updatedAt: string
  members: UserSummary[]
  lastMessage: { body: string; createdAt: string } | null
}

export interface TaskComment {
  id: string
  body: string
  createdAt: string
  author: UserSummary
}

export type ActivityKind =
  | 'task-created'
  | 'task-moved'
  | 'member-added'
  | 'chat-created'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  subject: string
  detail: string | null
  createdAt: string
  actor: UserSummary
}

export interface Message {
  id: string
  body: string
  createdAt: string
  author: UserSummary & {
    role: string | null
  }
}

export interface ProjectMember extends UserSummary {
  roleId: string
  role: string
  canManage: boolean
}

export interface Column {
  id: TaskStatus
  title: string
}
