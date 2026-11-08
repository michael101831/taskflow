import { useEffect, useRef, useState } from 'react'
import type { AppNotification } from '../types'
import { personName } from './Avatar'

interface NotificationMenuProps {
  unreadCount: number
  items: AppNotification[]
  onSelect: (item: AppNotification) => void
  onMarkAllRead: () => void
}

function describe(item: AppNotification) {
  const actor = personName(item.actor)

  if (item.kind === 'task-assigned') return `${actor} assigned you “${item.subject}”`
  if (item.kind === 'message') {
    return item.detail
      ? `${actor} in ${item.subject}: ${item.detail}`
      : `${actor} sent a message in ${item.subject}`
  }
  if (item.subject === 'Call') return `${actor} invited you to a call`
  return `${actor} invited you to the call “${item.subject}”`
}

export function NotificationMenu({
  unreadCount,
  items,
  onSelect,
  onMarkAllRead,
}: NotificationMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [isOpen])

  return (
    <div className="notifications" ref={rootRef}>
      <button
        className="secondary-button notifications__button"
        type="button"
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        onClick={() => setIsOpen((open) => !open)}
      >
        Notifications
        {unreadCount > 0 && <span className="notifications__badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <section className="notifications__panel" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button type="button" onClick={onMarkAllRead}>
                Mark all read
              </button>
            )}
          </header>
          {items.length === 0 ? (
            <p className="notifications__empty">You're all caught up.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.readAt ? '' : 'notifications__item--unread'}
                    onClick={() => {
                      setIsOpen(false)
                      onSelect(item)
                    }}
                  >
                    <span>{describe(item)}</span>
                    <small>
                      {item.projectName} · {new Date(item.createdAt).toLocaleString()}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
