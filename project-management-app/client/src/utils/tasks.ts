import type { Task, TaskInput, TaskStatus } from '../types'

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
