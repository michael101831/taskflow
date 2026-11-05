import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { filterBoardTasks, isTaskOverdue, taskToInput } from './tasks'

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

describe('filterBoardTasks', () => {
  const other: Task = {
    ...task,
    id: 8,
    title: 'Finished work',
    status: 'done',
    priority: 'low',
    dueDate: '2026-10-01',
    assignee: null,
  }

  it('keeps tasks that match assignee, priority, and overdue together', () => {
    expect(
      filterBoardTasks(
        [task, other],
        { assigneeId: 'developer-id', priority: 'high', overdueOnly: true },
        '2026-12-01',
      ).map((item) => item.id),
    ).toEqual([7])
  })

  it('treats a finished task as not overdue', () => {
    expect(isTaskOverdue(other, '2026-12-01')).toBe(false)
    expect(
      filterBoardTasks([other], { assigneeId: 'unassigned', priority: 'all', overdueOnly: true }, '2026-12-01'),
    ).toEqual([])
  })
})
