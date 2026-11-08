import { useEffect, useState } from 'react'
import type { ActivityEvent } from '../types'
import { activityApi } from '../services/api'
import { Avatar, personName } from './Avatar'

function describe(event: ActivityEvent) {
  const actor = personName(event.actor)

  if (event.kind === 'task-created') return `${actor} created “${event.subject}”`
  if (event.kind === 'task-moved') {
    return `${actor} moved “${event.subject}” from ${event.detail}`
  }
  if (event.kind === 'member-added') return `${actor} added ${event.subject}`
  if (event.detail === 'direct') return `${actor} started a chat with ${event.subject}`
  return `${actor} started the chat “${event.subject}”`
}

export function ActivityPanel({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setErrorMessage('')

    async function loadActivity() {
      try {
        const saved = await activityApi.list(projectId)
        if (!isCurrent) return
        setEvents(saved)
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Activity could not be loaded.',
          )
        }
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadActivity()

    return () => {
      isCurrent = false
    }
  }, [projectId])

  if (isLoading) {
    return (
      <p className="loading-message" role="status">
        Loading activity...
      </p>
    )
  }

  if (errorMessage) {
    return (
      <p className="request-error" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (events.length === 0) {
    return <p className="activity__empty">Nothing has happened in this project yet.</p>
  }

  return (
    <ol className="activity">
      {events.map((event) => (
        <li key={event.id} className="activity__item">
          <Avatar person={event.actor} />
          <p>{describe(event)}</p>
          <time dateTime={event.createdAt}>
            {new Date(event.createdAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ol>
  )
}
