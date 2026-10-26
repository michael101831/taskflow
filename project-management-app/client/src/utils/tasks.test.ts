import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { taskToInput } from './tasks'

const task: Task = {
  id: 7,
  title: 'Build event search',
  description: 'Connect the search form to the events API.',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-11-02',
  assignee: {
    id: 'developer-id',
    email: 'developer@taskflow.local',
    displayName: null,
  },
}

describe('taskToInput', () => {
  it('converts API task data into an update payload', () => {
    expect(taskToInput(task)).toEqual({
      title: task.title,
      description: task.description,
      status: 'todo',
      priority: 'high',
      dueDate: '2026-11-02',
      assigneeId: 'developer-id',
    })
  })

  it('can change status while preserving the remaining task data', () => {
    expect(taskToInput(task, 'done')).toMatchObject({
      status: 'done',
      assigneeId: 'developer-id',
    })
  })
})
