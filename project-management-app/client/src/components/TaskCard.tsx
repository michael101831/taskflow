import { useDraggable } from '@dnd-kit/core'
import type { Task, TaskStatus } from '../types'

interface TaskCardProps {
  task: Task
  onMove: (taskId: number, status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onComment: (task: Task) => void
}

const statusOrder: TaskStatus[] = ['todo', 'in-progress', 'done']

export function TaskCard({
  task,
  onMove,
  onEdit,
  onDelete,
  onComment,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
  })
  const statusIndex = statusOrder.indexOf(task.status)
  const previousStatus = statusOrder[statusIndex - 1]
  const nextStatus = statusOrder[statusIndex + 1]
  const formattedDueDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${task.dueDate}T00:00:00`))

  return (
    <article
      ref={setNodeRef}
      className={`task-card${isDragging ? ' task-card--dragging' : ''}`}
    >
      <div className="task-card__top">
        <span className={`priority priority--${task.priority}`}>
          {task.priority}
        </span>
        <div className="task-card__meta">
          <span className="due-date">{formattedDueDate}</span>
          <button
            className="drag-handle"
            type="button"
            aria-label={`Drag ${task.title}`}
            {...listeners}
            {...attributes}
          >
            ⠿
          </button>
        </div>
      </div>

      <h3>{task.title}</h3>
      <p>{task.description}</p>
      <span className="assignee">
        {task.assignee
          ? `Assigned to ${task.assignee.displayName || task.assignee.email}`
          : 'Unassigned'}
      </span>

      <div className="task-card__actions">
        <div className="task-card__manage">
          <button type="button" onClick={() => onComment(task)}>
            Comments
          </button>
          <button type="button" onClick={() => onEdit(task)}>
            Edit
          </button>
          <button
            className="delete-button"
            type="button"
            onClick={() => onDelete(task)}
          >
            Delete
          </button>
        </div>
        <div className="task-card__move">
          <button
            type="button"
            disabled={!previousStatus}
            onClick={() => previousStatus && onMove(task.id, previousStatus)}
            aria-label={`Move ${task.title} to the previous column`}
          >
            ←
          </button>
          <button
            type="button"
            disabled={!nextStatus}
            onClick={() => nextStatus && onMove(task.id, nextStatus)}
            aria-label={`Move ${task.title} to the next column`}
          >
            →
          </button>
        </div>
      </div>
    </article>
  )
}

export function TaskCardPreview({ task }: { task: Task }) {
  const formattedDueDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${task.dueDate}T00:00:00`))

  return (
    <article className="task-card task-card--preview">
      <div className="task-card__top">
        <span className={`priority priority--${task.priority}`}>
          {task.priority}
        </span>
        <span className="due-date">{formattedDueDate}</span>
      </div>
      <h3>{task.title}</h3>
      <p>{task.description}</p>
    </article>
  )
}
