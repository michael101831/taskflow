import { describe, expect, it } from 'vitest'
import type { Project } from '../types'
import { sortProjects } from './projects'

const projects: Project[] = [
  {
    id: 'beta',
    name: 'Beta',
    description: '',
    role: 'Member',
    canManage: false,
    bookmarked: true,
    updatedAt: '2026-10-01T00:00:00.000Z',
    memberCount: 1,
    taskCount: 0,
    taskCounts: { todo: 0, 'in-progress': 0, done: 0 },
  },
  {
    id: 'alpha',
    name: 'Alpha',
    description: '',
    role: 'Manager',
    canManage: true,
    bookmarked: false,
    updatedAt: '2026-10-16T00:00:00.000Z',
    memberCount: 2,
    taskCount: 1,
    taskCounts: { todo: 1, 'in-progress': 0, done: 0 },
  },
]

describe('sortProjects', () => {
  it('sorts by name, bookmarks, and recent updates', () => {
    expect(sortProjects(projects, 'name').map((project) => project.name)).toEqual([
      'Alpha',
      'Beta',
    ])
    expect(
      sortProjects(projects, 'bookmarked').map((project) => project.name),
    ).toEqual(['Beta', 'Alpha'])
    expect(sortProjects(projects, 'recent').map((project) => project.name)).toEqual([
      'Alpha',
      'Beta',
    ])
  })
})