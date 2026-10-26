import { useState, type FormEvent } from 'react'

interface ProjectFormModalProps {
  onClose: () => void
  onSave: (input: { name: string; description: string }) => Promise<void>
}

export function ProjectFormModal({
  onClose,
  onSave,
}: ProjectFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage('')

    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
      })
      onClose()
    } catch {
      setErrorMessage('The project could not be created.')
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <p className="eyebrow">New workspace</p>
            <h2 id="project-form-title">Create project</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close project form"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            Project name
            <input
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="For example: Website redesign"
            />
          </label>

          <label>
            Description
            <textarea
              rows={3}
              maxLength={240}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this project for?"
            />
          </label>

          <footer className="modal__actions">
            {errorMessage && <p className="form-error">{errorMessage}</p>}
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create project'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
