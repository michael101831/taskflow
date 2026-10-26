import { DndContext } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import { TaskCard } from './TaskCard'

const task: Task = {
  id: 3,
  title: 'Research events API',
  description: 'Compare event providers.',
  status: 'todo',
  priority: 'medium',
  dueDate: '2026-10-30',
  assignee: {
    id: 'developer-id',
    email: 'developer@taskflow.local',
    displayName: 'Developer',
  },
}

function renderCard(onMove = vi.fn()) {
  render(
    <DndContext>
      <TaskCard
        task={task}
        onMove={onMove}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </DndContext>,
  )

  return onMove
}

describe('TaskCard', () => {
  it('displays task details and its assignee', () => {
    renderCard()

    expect(
      screen.getByRole('heading', { name: task.title }),
    ).toBeInTheDocument()
    expect(screen.getByText('Assigned to Developer')).toBeInTheDocument()
    expect(screen.getByText('Oct 30')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Drag ${task.title}` }),
    ).toBeInTheDocument()
  })

  it('retains button-based movement as an accessible fallback', async () => {
    const user = userEvent.setup()
    const onMove = renderCard()

    await user.click(
      screen.getByRole('button', {
        name: `Move ${task.title} to the next column`,
      }),
    )

    expect(onMove).toHaveBeenCalledWith(task.id, 'in-progress')
  })
})
