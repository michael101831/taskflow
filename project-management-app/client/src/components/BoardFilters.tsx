import type { ProjectMember, TaskPriority } from '../types'
import type { BoardFilters as BoardFilterState } from '../utils/tasks'

interface BoardFiltersProps {
  members: ProjectMember[]
  filters: BoardFilterState
  onChange: (filters: BoardFilterState) => void
}

const priorities: { id: 'all' | TaskPriority; label: string }[] = [
  { id: 'all', label: 'Any priority' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

function personName(member: ProjectMember) {
  return member.displayName || member.email
}

export function BoardFilters({ members, filters, onChange }: BoardFiltersProps) {
  const isFiltered =
    filters.assigneeId !== 'all' || filters.priority !== 'all' || filters.overdueOnly

  return (
    <div className="board-filters">
      <label>
        Assignee
        <select
          value={filters.assigneeId}
          onChange={(event) =>
            onChange({ ...filters, assigneeId: event.target.value })
          }
        >
          <option value="all">Everyone</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {personName(member)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select
          value={filters.priority}
          onChange={(event) =>
            onChange({
              ...filters,
              priority: event.target.value as BoardFilterState['priority'],
            })
          }
        >
          {priorities.map((priority) => (
            <option key={priority.id} value={priority.id}>
              {priority.label}
            </option>
          ))}
        </select>
      </label>
      <label className="board-filters__check">
        <input
          type="checkbox"
          checked={filters.overdueOnly}
          onChange={(event) =>
            onChange({ ...filters, overdueOnly: event.target.checked })
          }
        />
        Overdue
      </label>
      {isFiltered && (
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            onChange({ assigneeId: 'all', priority: 'all', overdueOnly: false })
          }
        >
          Clear
        </button>
      )}
    </div>
  )
}
