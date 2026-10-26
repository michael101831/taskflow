import { useEffect, useState, type FormEvent } from 'react'
import type {
  ProjectMember,
  Task,
  TaskInput,
  TaskPriority,
  TaskStatus,
} from '../types'

interface TaskFormModalProps {
  task: Task | null
  members: ProjectMember[]
  onClose: () => void
  onSave: (task: TaskInput) => Promise<void>
}

const emptyTask: TaskInput = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
  assigneeId: null,
}

export function TaskFormModal({
  task,
  members,
  onClose,
  onSave,
}: TaskFormModalProps) {
  const [formData, setFormData] = useState<TaskInput>(
    task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          assigneeId: task.assignee?.id ?? null,
        }
      : emptyTask,
  )
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setSaveError('')

    try {
      await onSave({
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
      })
      onClose()
    } catch {
      setSaveError('The task could not be saved. Please try again.')
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <p className="eyebrow">{task ? 'Update task' : 'New task'}</p>
            <h2 id="task-form-title">
              {task ? 'Edit task' : 'Add a task'}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close task form"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            Title
            <input
              autoFocus
              required
              maxLength={80}
              value={formData.title}
              onChange={(event) =>
                setFormData({ ...formData, title: event.target.value })
              }
              placeholder="For example: Build login page"
            />
          </label>

          <label>
            Description
            <textarea
              rows={3}
              maxLength={240}
              value={formData.description}
              onChange={(event) =>
                setFormData({ ...formData, description: event.target.value })
              }
              placeholder="What needs to be completed?"
            />
          </label>

          <div className="form-row">
            <label>
              Status
              <select
                value={formData.status}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    status: event.target.value as TaskStatus,
                  })
                }
              >
                <option value="todo">To do</option>
                <option value="in-progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>

            <label>
              Priority
              <select
                value={formData.priority}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    priority: event.target.value as TaskPriority,
                  })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <label>
            Due date
            <input
              required
              type="date"
              value={formData.dueDate}
              onChange={(event) =>
                setFormData({ ...formData, dueDate: event.target.value })
              }
            />
          </label>

          <label>
            Assignee
            <select
              value={formData.assigneeId ?? ''}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  assigneeId: event.target.value || null,
                })
              }
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName || member.email}
                </option>
              ))}
            </select>
          </label>

          <footer className="modal__actions">
            {saveError && <p className="form-error">{saveError}</p>}
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving
                ? 'Saving...'
                : task
                  ? 'Save changes'
                  : 'Create task'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
