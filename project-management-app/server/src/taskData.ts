import {
  TaskPriority,
  TaskStatus,
  type Task,
  type User,
} from '@prisma/client'
import { serializeUser } from './lib/users.js'

export interface TaskInput {
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  dueDate: string
  assigneeId: string | null
}

const statuses = new Set(['todo', 'in-progress', 'done'])
const priorities = new Set(['low', 'medium', 'high'])

export const statusToDatabase: Record<TaskInput['status'], TaskStatus> = {
  todo: TaskStatus.TODO,
  'in-progress': TaskStatus.IN_PROGRESS,
  done: TaskStatus.DONE,
}

export const priorityToDatabase: Record<
  TaskInput['priority'],
  TaskPriority
> = {
  low: TaskPriority.LOW,
  medium: TaskPriority.MEDIUM,
  high: TaskPriority.HIGH,
}

export const statusFromDatabase: Record<TaskStatus, TaskInput['status']> = {
  TODO: 'todo',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
}

export type TaskCounts = Record<TaskInput['status'], number>

export function emptyTaskCounts(): TaskCounts {
  return { todo: 0, 'in-progress': 0, done: 0 }
}

const priorityFromDatabase: Record<TaskPriority, TaskInput['priority']> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
}

export function parseTaskInput(value: unknown): TaskInput | null {
  if (!value || typeof value !== 'object') return null

  const input = value as Record<string, unknown>
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const description =
    typeof input.description === 'string' ? input.description.trim() : ''
  const status = input.status
  const priority = input.priority
  const dueDate = input.dueDate
  const assigneeId =
    typeof input.assigneeId === 'string' && input.assigneeId
      ? input.assigneeId
      : null

  if (
    !title ||
    title.length > 80 ||
    description.length > 240 ||
    typeof status !== 'string' ||
    !statuses.has(status) ||
    typeof priority !== 'string' ||
    !priorities.has(priority) ||
    typeof dueDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
    (input.assigneeId !== undefined &&
      input.assigneeId !== null &&
      typeof input.assigneeId !== 'string')
  ) {
    return null
  }

  return {
    title,
    description,
    status: status as TaskInput['status'],
    priority: priority as TaskInput['priority'],
    dueDate,
    assigneeId,
  }
}

export function serializeAssignedTask(
  task: Task & {
    assignee: User | null
    project: { id: string; name: string }
  },
) {
  return {
    ...serializeTask(task),
    projectId: task.project.id,
    projectName: task.project.name,
  }
}

export function serializeTask(
  task: Task & { assignee: User | null },
) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: statusFromDatabase[task.status],
    priority: priorityFromDatabase[task.priority],
    dueDate: task.dueDate.toISOString().slice(0, 10),
    assignee: task.assignee ? serializeUser(task.assignee) : null,
  }
}
