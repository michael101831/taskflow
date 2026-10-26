import type { Project, TaskCounts, TaskStatus } from '../types'

export type ProjectSort = 'name' | 'bookmarked' | 'recent'

export function sortProjects(projects: Project[], sort: ProjectSort) {
  const sorted = [...projects]

  if (sort === 'recent') {
    sorted.sort((left, right) =>
      (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''),
    )
    return sorted
  }

  if (sort === 'bookmarked') {
    sorted.sort((left, right) => {
      if (left.bookmarked !== right.bookmarked) return left.bookmarked ? -1 : 1
      return (left.name ?? '').localeCompare(right.name ?? '')
    })
    return sorted
  }

  sorted.sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''))
  return sorted
}

export function applyTaskCountChange(
  project: Project,
  change: { from?: TaskStatus | null; to?: TaskStatus | null },
) {
  const taskCounts: TaskCounts = { ...project.taskCounts }
  if (change.from) taskCounts[change.from] = Math.max(0, taskCounts[change.from] - 1)
  if (change.to) taskCounts[change.to] += 1

  return {
    ...project,
    taskCounts,
    taskCount: taskCounts.todo + taskCounts['in-progress'] + taskCounts.done,
  }
}
