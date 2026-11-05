import { useEffect, useState, type FormEvent } from 'react'
import type { Conversation, Message, ProjectMember } from '../types'
import { roleLabel } from '../utils/roles'

interface MessagesPanelProps {
  conversations: Conversation[]
  activeConversationId: string
  messages: Message[]
  members: ProjectMember[]
  currentUserId: string
  canManage: boolean
  isLoading: boolean
  onSelect: (conversationId: string) => void
  onCreate: (input: {
    kind: 'direct' | 'group'
    name?: string
    memberIds?: string[]
    wholeProject?: boolean
  }) => Promise<void>
  onSend: (body: string) => Promise<void>
  onLeave: (conversationId: string) => Promise<void>
  onDelete: (messageId: string) => Promise<void>
}

function personName(person: { displayName: string | null; email: string }) {
  return person.displayName || person.email
}

export function MessagesPanel({
  conversations,
  activeConversationId,
  messages,
  members,
  currentUserId,
  canManage,
  isLoading,
  onSelect,
  onCreate,
  onSend,
  onLeave,
  onDelete,
}: MessagesPanelProps) {
  const [draft, setDraft] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [projectGroupName, setProjectGroupName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isConfirmingChat, setIsConfirmingChat] = useState(false)
  const [isLeavingChat, setIsLeavingChat] = useState(false)
  const coworkers = members.filter((member) => member.id !== currentUserId)
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )
  const chatKind = selectedIds.length > 1 ? 'group' : 'direct'
  const isLastMember = (activeConversation?.members.length ?? 0) <= 1
  const chatAction = isLastMember ? 'Delete' : 'Leave'

  useEffect(() => {
    setIsConfirmingChat(false)
  }, [activeConversationId])

  function toggleMember(memberId: string) {
    setSelectedIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    )
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    setErrorMessage('')

    try {
      await onCreate({
        kind: chatKind,
        name: chatKind === 'group' ? groupName : undefined,
        memberIds: selectedIds,
      })
      setIsComposerOpen(false)
      setGroupName('')
      setProjectGroupName('')
      setSelectedIds([])
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The chat could not be created.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function handleLeaveChat() {
    if (!activeConversation) return

    setIsLeavingChat(true)
    setErrorMessage('')

    try {
      await onLeave(activeConversation.id)
      setIsConfirmingChat(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The chat could not be updated.',
      )
    } finally {
      setIsLeavingChat(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !activeConversationId) return

    setIsSending(true)
    setErrorMessage('')

    try {
      await onSend(body)
      setDraft('')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The message could not be sent.',
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="message-layout">
      <aside className="chat-list" aria-label="Chats">
        <div className="chat-list__header">
          <h2>Chats</h2>
          <button
            type="button"
            onClick={() => {
              setIsComposerOpen((open) => !open)
              setErrorMessage('')
            }}
          >
            {isComposerOpen ? 'Close' : 'New chat'}
          </button>
        </div>

        {isComposerOpen && canManage && (
          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault()
              void (async () => {
                setIsCreating(true)
                setErrorMessage('')
                try {
                  await onCreate({
                    kind: 'group',
                    name: projectGroupName,
                    wholeProject: true,
                  })
                  setIsComposerOpen(false)
                  setProjectGroupName('')
                } catch (error) {
                  setErrorMessage(
                    error instanceof Error
                      ? error.message
                      : 'The project group could not be created.',
                  )
                } finally {
                  setIsCreating(false)
                }
              })()
            }}
          >
            <label>
              Group name
              <input
                type="text"
                value={projectGroupName}
                maxLength={40}
                placeholder="Everyone"
                onChange={(event) => setProjectGroupName(event.target.value)}
                required
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={isCreating || !projectGroupName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create project group'}
            </button>
            {errorMessage && (
              <p className="request-error" role="alert">
                {errorMessage}
              </p>
            )}
          </form>
        )}

        {isComposerOpen && (
          <form className="chat-form" onSubmit={(event) => void handleCreate(event)}>
            {chatKind === 'group' && (
              <label>
                Group name
                <input
                  type="text"
                  value={groupName}
                  maxLength={40}
                  placeholder="Design review"
                  onChange={(event) => setGroupName(event.target.value)}
                  required
                />
              </label>
            )}

            <fieldset>
              <legend>Coworkers</legend>
              {coworkers.length === 0 ? (
                <p>Add a teammate in Members before starting another chat.</p>
              ) : (
                <>
                {coworkers.length > 1 && (
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        coworkers.length > 0 &&
                        coworkers.every((member) => selectedIds.includes(member.id))
                      }
                      onChange={(event) => {
                        setSelectedIds(
                          event.target.checked
                            ? coworkers.map((member) => member.id)
                            : [],
                        )
                      }}
                    />
                    Whole project team
                  </label>
                )}
                {coworkers.map((member) => (
                  <label key={member.id}>
                    <input
                      type="checkbox"
                      name="chat-members"
                      checked={selectedIds.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                    />
                    {personName(member)}
                    <span>{member.role}</span>
                  </label>
                ))}
                </>
              )}
            </fieldset>

            <button
              className="primary-button"
              type="submit"
              disabled={isCreating || coworkers.length === 0 || selectedIds.length === 0}
            >
              {isCreating ? 'Creating...' : 'Create chat'}
            </button>
          </form>
        )}

        <ul className="chat-list__items">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className={
                  conversation.id === activeConversationId
                    ? 'chat-list__item chat-list__item--active'
                    : 'chat-list__item'
                }
                aria-current={
                  conversation.id === activeConversationId ? 'true' : undefined
                }
                onClick={() => onSelect(conversation.id)}
              >
                <span className="chat-list__name">{conversation.name}</span>
                <span className="chat-list__kind">
                  {conversation.kind === 'team'
                    ? 'Team'
                    : conversation.kind === 'direct'
                      ? 'Direct'
                      : 'Group'}
                </span>
                {conversation.lastMessage && (
                  <span className="chat-list__preview">
                    {conversation.lastMessage.body}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="messages" aria-label="Messages">
        <div className="messages__log">
          {activeConversation && (
            <div className="messages__heading">
              <p className="messages__title">{activeConversation.name}</p>
              {isConfirmingChat ? (
                <span className="message__confirm">
                  <span>{chatAction} this chat?</span>
                  <button
                    type="button"
                    disabled={isLeavingChat}
                    onClick={() => void handleLeaveChat()}
                  >
                    {isLeavingChat ? 'Working...' : chatAction}
                  </button>
                  <button
                    type="button"
                    disabled={isLeavingChat}
                    onClick={() => setIsConfirmingChat(false)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  className="danger-button messages__chat-action"
                  type="button"
                  onClick={() => setIsConfirmingChat(true)}
                >
                  {chatAction} chat
                </button>
              )}
            </div>
          )}
          {isLoading && messages.length === 0 && (
            <p className="messages__empty" role="status">
              Loading messages...
            </p>
          )}
          {!isLoading && messages.length === 0 && (
            <p className="messages__empty">
              No messages yet. Start the conversation.
            </p>
          )}
          <ol className="messages__list">
            {messages.map((message) => (
              <li key={message.id} className="message">
                <div className="message__meta">
                  <span className="message__author">
                    {personName(message.author)}
                    <span className="message__role">
                      {roleLabel(message.author.role)}
                    </span>
                  </span>
                  <span className="message__actions">
                    <time dateTime={message.createdAt}>
                      {new Date(message.createdAt).toLocaleString()}
                    </time>
                    {message.author.id === currentUserId &&
                      (pendingDeleteId === message.id ? (
                        <span className="message__confirm">
                          <span>Delete this message?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingDeleteId(null)
                              void onDelete(message.id)
                            }}
                          >
                            Delete
                          </button>
                          <button type="button" onClick={() => setPendingDeleteId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(message.id)}
                        >
                          Delete
                        </button>
                      ))}
                  </span>
                </div>
                <p>{message.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <form className="messages__composer" onSubmit={(event) => void handleSubmit(event)}>
          <label className="visually-hidden" htmlFor="message-body">
            Message
          </label>
          <textarea
            id="message-body"
            value={draft}
            maxLength={1000}
            placeholder={
              activeConversation
                ? `Message ${activeConversation.name}`
                : 'Choose a chat'
            }
            disabled={!activeConversationId}
            onChange={(event) => setDraft(event.target.value)}
          />
          {errorMessage && (
            <p className="request-error" role="alert">
              {errorMessage}
            </p>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={isSending || !draft.trim() || !activeConversationId}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  )
}
