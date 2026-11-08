import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectMember } from '../types'
import { TaskFormModal } from './TaskFormModal'

const member: ProjectMember = {
  id: 'developer-id',
  email: 'developer@taskflow.local',
  displayName: 'Developer',
  photoUrl: null,
  roleId: 'manager-role',
  role: 'Manager',
  canManage: true,
}

describe('TaskFormModal', () => {
  it('submits a new task with its selected assignee', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <TaskFormModal
        task={null}
        members={[member]}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    await user.type(screen.getByLabelText('Title'), 'Build map view')
    await user.type(
      screen.getByLabelText('Description'),
      'Display event locations on a map.',
    )
    await user.type(screen.getByLabelText('Due date'), '2026-11-05')
    await user.selectOptions(screen.getByLabelText('Assignee'), member.id)
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(onSave).toHaveBeenCalledWith({
      title: 'Build map view',
      description: 'Display event locations on a map.',
      status: 'todo',
      priority: 'medium',
      dueDate: '2026-11-05',
      assigneeId: member.id,
    })
  })
})
