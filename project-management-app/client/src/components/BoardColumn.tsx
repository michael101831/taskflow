import { useDroppable } from '@dnd-kit/core'
import type { Column, Task, TaskStatus } from '../types'
import { TaskCard } from './TaskCard'

interface BoardColumnProps {
  column: Column
  tasks: Task[]
  onMoveTask: (taskId: number, status: TaskStatus) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
  onCommentTask: (task: Task) => void
}

export function BoardColumn({
  column,
  tasks,
  onMoveTask,
  onEditTask,
  onDeleteTask,
  onCommentTask,
}: BoardColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  })

  return (
    <section
      ref={setNodeRef}
      className={`board-column${isOver ? ' board-column--over' : ''}`}
    >
      <header className="board-column__header">
        <h2>{column.title}</h2>
        <span>{tasks.length}</span>
      </header>

      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onMove={onMoveTask}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onComment={onCommentTask}
          />
        ))}
      </div>
    </section>
  )
}
