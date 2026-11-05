import type { AssignedTask } from '../types'
import { columns } from '../data/columns'
import { isTaskOverdue } from '../utils/tasks'

interface MyTasksPanelProps {
  tasks: AssignedTask[]
  isLoading: boolean
  onOpenTask: (task: AssignedTask) => void
}

function dueLabel(dueDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dueDate}T00:00:00`))
}

export function MyTasksPanel({ tasks, isLoading, onOpenTask }: MyTasksPanelProps) {
  if (isLoading && tasks.length === 0) {
    return (
      <p className="loading-message" role="status">
        Loading your tasks...
      </p>
    )
  }

  if (tasks.length === 0) {
    return <p className="my-tasks__empty">Nothing is assigned to you yet.</p>
  }

  return (
    <ol className="my-tasks">
      {tasks.map((task) => {
        const overdue = isTaskOverdue(task)
        const status = columns.find((column) => column.id === task.status)?.title ?? task.status

        return (
          <li key={task.id}>
            <button
              className="my-task"
              type="button"
              onClick={() => onOpenTask(task)}
            >
              <span className="my-task__main">
                <span className="my-task__project">{task.projectName}</span>
                <span className="my-task__title">{task.title}</span>
              </span>
              <span className={`priority priority--${task.priority}`}>{task.priority}</span>
              <span className="my-task__status">{status}</span>
              <time
                dateTime={task.dueDate}
                className={overdue ? 'my-task__due my-task__due--overdue' : 'my-task__due'}
              >
                {overdue ? `Overdue · ${dueLabel(task.dueDate)}` : dueLabel(task.dueDate)}
              </time>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
