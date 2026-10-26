import { useState, type FormEvent } from 'react'
import type { ProjectMember, ProjectRole } from '../types'
import { roleLabel } from '../utils/roles'

interface MembersModalProps {
  members: ProjectMember[]
  roles: ProjectRole[]
  canManage: boolean
  onClose: () => void
  onAddMember: (email: string) => Promise<void>
  onAddRole: (name: string) => Promise<void>
  onChangeRole: (userId: string, roleId: string) => Promise<void>
}

export function MembersModal({
  members,
  roles,
  canManage,
  onClose,
  onAddMember,
  onAddRole,
  onChangeRole,
}: MembersModalProps) {
  const [email, setEmail] = useState('')
  const [roleName, setRoleName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isAddingRole, setIsAddingRole] = useState(false)
  const [changingUserId, setChangingUserId] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsAdding(true)
    setErrorMessage('')

    try {
      await onAddMember(email.trim())
      setEmail('')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The member could not be added.',
      )
    } finally {
      setIsAdding(false)
    }
  }

  async function handleAddRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsAddingRole(true)
    setErrorMessage('')

    try {
      await onAddRole(roleName.trim())
      setRoleName('')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The role could not be added.',
      )
    } finally {
      setIsAddingRole(false)
    }
  }

  async function handleRoleChange(member: ProjectMember, roleId: string) {
    setChangingUserId(member.id)
    setErrorMessage('')

    try {
      await onChangeRole(member.id, roleId)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The role could not be changed.',
      )
    } finally {
      setChangingUserId('')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <p className="eyebrow">Collaboration</p>
            <h2 id="members-title">Project members</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close members"
          >
            ×
          </button>
        </header>

        <div className="member-list">
          {members.map((member) => (
            <div className="member-row" key={member.id}>
              <div>
                <strong>{member.displayName || member.email}</strong>
                {member.displayName && <span>{member.email}</span>}
              </div>
              {canManage ? (
                <select
                  aria-label={`Role for ${member.displayName || member.email}`}
                  value={member.roleId}
                  disabled={changingUserId === member.id}
                  onChange={(event) =>
                    void handleRoleChange(member, event.target.value)
                  }
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="member-role">{roleLabel(member.role)}</span>
              )}
            </div>
          ))}
        </div>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        {canManage && (
          <>
            <form className="member-form" onSubmit={(event) => void handleAddRole(event)}>
              <label>
                New role
                <input
                  required
                  maxLength={32}
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="Designer"
                />
              </label>
              <button className="secondary-button" type="submit" disabled={isAddingRole}>
                {isAddingRole ? 'Adding...' : 'Add role'}
              </button>
            </form>

            <form className="member-form" onSubmit={(event) => void handleSubmit(event)}>
              <label>
                Add an existing TaskFlow user
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@example.com"
                />
              </label>
              <button className="primary-button" type="submit" disabled={isAdding}>
                {isAdding ? 'Adding...' : 'Add member'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
