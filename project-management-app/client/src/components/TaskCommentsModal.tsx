import { useEffect, useState, type FormEvent } from 'react'
import type { Task, TaskComment } from '../types'
import { tasksApi } from '../services/api'
import { Avatar, personName } from './Avatar'

interface TaskCommentsModalProps {
  projectId: string
  task: Task
  currentUserId: string
  onClose: () => void
}

export function TaskCommentsModal({
  projectId,
  task,
  currentUserId,
  onClose,
}: TaskCommentsModalProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [draft, setDraft] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    async function loadComments() {
      try {
        const saved = await tasksApi.listComments(projectId, task.id)
        if (isCurrent) {
          setComments(saved)
          setErrorMessage('')
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Comments could not be loaded.',
          )
        }
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadComments()

    return () => {
      isCurrent = false
    }
  }, [projectId, task.id])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return

    setIsSending(true)
    setErrorMessage('')

    try {
      const comment = await tasksApi.createComment(projectId, task.id, body)
      setComments((current) => [...current, comment])
      setDraft('')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The comment could not be posted.',
      )
    } finally {
      setIsSending(false)
    }
  }

  async function deleteComment(commentId: string) {
    setErrorMessage('')

    try {
      await tasksApi.removeComment(projectId, task.id, commentId)
      setComments((current) => current.filter((comment) => comment.id !== commentId))
      setPendingDeleteId(null)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The comment could not be deleted.',
      )
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal comment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-comments-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <p className="eyebrow">Task comments</p>
            <h2 id="task-comments-title">{task.title}</h2>
          </div>
          <button type="button" aria-label="Close comments" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="comment-modal__log">
          {isLoading && (
            <p className="messages__empty" role="status">
              Loading comments...
            </p>
          )}
          {!isLoading && comments.length === 0 && (
            <p className="messages__empty">No comments yet.</p>
          )}
          <ol className="messages__list">
            {comments.map((comment) => (
              <li key={comment.id} className="message">
                <div className="message__meta">
                  <span className="message__author">
                    <Avatar person={comment.author} />
                    {personName(comment.author)}
                  </span>
                  <span className="message__actions">
                    <time dateTime={comment.createdAt}>
                      {new Date(comment.createdAt).toLocaleString()}
                    </time>
                    {comment.author.id === currentUserId &&
                      (pendingDeleteId === comment.id ? (
                        <span className="message__confirm">
                          <span>Delete this comment?</span>
                          <button type="button" onClick={() => void deleteComment(comment.id)}>
                            Delete
                          </button>
                          <button type="button" onClick={() => setPendingDeleteId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setPendingDeleteId(comment.id)}>
                          Delete
                        </button>
                      ))}
                  </span>
                </div>
                <p>{comment.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <form className="messages__composer" onSubmit={(event) => void handleSubmit(event)}>
          <label className="visually-hidden" htmlFor="task-comment-body">
            Comment
          </label>
          <textarea
            id="task-comment-body"
            value={draft}
            maxLength={1000}
            placeholder={`Comment on ${task.title}`}
            onChange={(event) => setDraft(event.target.value)}
          />
          {errorMessage && (
            <p className="request-error" role="alert">
              {errorMessage}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={isSending || !draft.trim()}>
            {isSending ? 'Posting...' : 'Post'}
          </button>
        </form>
      </section>
    </div>
  )
}
