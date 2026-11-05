import type { Task, TaskInput, TaskPriority, TaskStatus } from '../types'

export interface BoardFilters {
  assigneeId: 'all' | 'unassigned' | string
  priority: 'all' | TaskPriority
  overdueOnly: boolean
}

export function formatToday(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isTaskOverdue(
  task: Pick<Task, 'dueDate' | 'status'>,
  today = formatToday(),
) {
  return task.status !== 'done' && task.dueDate < today
}

export function filterBoardTasks(
  tasks: Task[],
  filters: BoardFilters,
  today = formatToday(),
) {
  return tasks.filter((task) => {
    if (filters.assigneeId === 'unassigned' && task.assignee) return false
    if (
      filters.assigneeId !== 'all' &&
      filters.assigneeId !== 'unassigned' &&
      task.assignee?.id !== filters.assigneeId
    ) {
      return false
    }
    if (filters.priority !== 'all' && task.priority !== filters.priority) {
      return false
    }
    if (filters.overdueOnly && !isTaskOverdue(task, today)) return false
    return true
  })
}

export function taskToInput(
  task: Task,
  status: TaskStatus = task.status,
): TaskInput {
  return {
    title: task.title,
    description: task.description,
    status,
    priority: task.priority,
    dueDate: task.dueDate,
    assigneeId: task.assignee?.id ?? null,
  }
}
