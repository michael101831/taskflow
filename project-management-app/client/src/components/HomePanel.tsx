import type { Project, TaskCounts } from '../types'
import { columns } from '../data/columns'

const emptyCounts: TaskCounts = { todo: 0, 'in-progress': 0, done: 0 }

function countsFor(project: Project) {
  return project.taskCounts ?? emptyCounts
}

interface HomePanelProps {
  projects: Project[]
  onOpenProject: (projectId: string) => void
  onToggleBookmark: (project: Project) => void
  onCreateProject: () => void
}

export function HomePanel({
  projects,
  onOpenProject,
  onToggleBookmark,
  onCreateProject,
}: HomePanelProps) {
  const openTaskCount = projects.reduce(
    (total, project) =>
      total + countsFor(project).todo + countsFor(project)['in-progress'],
    0,
  )
  const inProgressCount = projects.reduce(
    (total, project) => total + countsFor(project)['in-progress'],
    0,
  )

  if (projects.length === 0) {
    return (
      <section className="home-empty" aria-label="Your projects">
        <p>No projects yet.</p>
        <button className="primary-button" type="button" onClick={onCreateProject}>
          + New project
        </button>
      </section>
    )
  }

  return (
    <section className="home" aria-label="Your projects">
      <div className="home-stats">
        <article className="home-stat">
          <strong>{projects.length}</strong>
          <span>Projects</span>
        </article>
        <article className="home-stat">
          <strong>{openTaskCount}</strong>
          <span>Open tasks</span>
        </article>
        <article className="home-stat">
          <strong>{inProgressCount}</strong>
          <span>In progress</span>
        </article>
      </div>

      <div className="home-projects">
        {projects.map((project) => (
          <article key={project.id} className="home-project">
            <button
              className="home-project__open"
              type="button"
              onClick={() => onOpenProject(project.id)}
            >
              <h2>{project.name}</h2>
              <p>
                {project.description || 'No description yet.'}
              </p>
              <div className="home-project__counts">
                {columns.map((column) => (
                  <span key={column.id}>
                    <strong>{countsFor(project)[column.id]}</strong>
                    {column.title}
                  </span>
                ))}
              </div>
            </button>
            <div className="home-project__meta">
              {project.bookmarked && (
                <span className="role-pill">Bookmarked</span>
              )}
              <span className="role-pill">
                {typeof project.role === 'string' && project.role
                  ? project.role
                  : 'Member'}
              </span>
              <button
                className={
                  project.bookmarked
                    ? 'home-project__bookmark home-project__bookmark--on'
                    : 'home-project__bookmark'
                }
                type="button"
                aria-pressed={project.bookmarked}
                aria-label={
                  project.bookmarked
                    ? `Remove bookmark from ${project.name}`
                    : `Bookmark ${project.name}`
                }
                onClick={() => onToggleBookmark(project)}
              >
                {project.bookmarked ? '★' : '☆'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
