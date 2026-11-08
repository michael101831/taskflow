import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from '@firebase/auth'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import './styles.css'
import { ActivityPanel } from './components/ActivityPanel'
import { AuthPage } from './components/AuthPage'
import { CallPanel } from './components/CallPanel'
import { BoardColumn } from './components/BoardColumn'
import { BoardFilters } from './components/BoardFilters'
import { HomePanel } from './components/HomePanel'
import { MyTasksPanel } from './components/MyTasksPanel'
import { MembersModal } from './components/MembersModal'
import { MessagesPanel } from './components/MessagesPanel'
import { NotificationMenu } from './components/NotificationMenu'
import { ProfileModal } from './components/ProfileModal'
import { Avatar, personName } from './components/Avatar'
import { ProjectFormModal } from './components/ProjectFormModal'
import { TaskCardPreview } from './components/TaskCard'
import { TaskCommentsModal } from './components/TaskCommentsModal'
import { TaskFormModal } from './components/TaskFormModal'
import { columns } from './data/columns'
import { auth } from './lib/firebase'
import { apiUrl, messagesApi, notificationsApi, profileApi, projectsApi, tasksApi } from './services/api'
import {
  applyTaskCountChange,
  sortProjects,
  type ProjectSort,
} from './utils/projects'
import { filterBoardTasks, taskToInput, type BoardFilters as BoardFilterState } from './utils/tasks'
import type {
  AppNotification,
  AssignedTask,
  Conversation,
  Message,
  Profile,
  ProfilePhotoUpdate,
  Project,
  ProjectMember,
  ProjectRole,
  Task,
  TaskInput,
  TaskStatus,
} from './types'

const projectSorts: { id: ProjectSort; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'bookmarked', label: 'Bookmarked' },
  { id: 'recent', label: 'Recent' },
]

type AppSection = 'home' | 'my-tasks' | 'board' | 'activity' | 'messages' | 'call'

const emptyBoardFilters: BoardFilterState = {
  assigneeId: 'all',
  priority: 'all',
  overdueOnly: false,
}

function pageHeading(section: AppSection, project: Project | null) {
  if (section === 'home') {
    return {
      eyebrow: 'Home',
      title: 'Your projects',
      description:
        'Pick a project to open its board. Bookmarks stay at the top when you sort by bookmark.',
    }
  }

  if (section === 'my-tasks') {
    return {
      eyebrow: 'My tasks',
      title: 'Assigned to you',
      description:
        'Tasks from every project you belong to, with the soonest due date first.',
    }
  }

  if (section === 'activity') {
    return {
      eyebrow: 'Activity',
      title: project?.name ?? 'Select a project',
      description: project ? 'Recent changes in this project.' : '',
    }
  }

  if (section === 'messages') {
    return {
      eyebrow: 'Team messages',
      title: project?.name ?? 'Select a project',
      description: project?.description ?? '',
    }
  }

  if (section === 'call') {
    return {
      eyebrow: 'Calls',
      title: project?.name ?? 'Select a project',
      description: project
        ? 'Private rooms. Only the people you invite can see a call.'
        : '',
    }
  }

  return {
    eyebrow: 'Project board',
    title: project?.name ?? 'Select a project',
    description: project?.description ?? '',
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState('')
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [roles, setRoles] = useState<ProjectRole[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [apiOnline, setApiOnline] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [requestError, setRequestError] = useState('')
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
  const [isMembersOpen, setIsMembersOpen] = useState(false)
  const [commentingTask, setCommentingTask] = useState<Task | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [section, setSection] = useState<AppSection>('home')
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([])
  const [isAssignedLoading, setIsAssignedLoading] = useState(false)
  const [boardFilters, setBoardFilters] = useState<BoardFilterState>(emptyBoardFilters)
  const [projectSort, setProjectSort] = useState<ProjectSort>('name')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isMessagesLoading, setIsMessagesLoading] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setIsAuthLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user) return

    let isCurrent = true

    async function loadProjects() {
      setIsLoading(true)

      try {
        const [healthResponse, savedProjects] = await Promise.all([
          fetch(apiUrl('/api/health')),
          projectsApi.list(),
        ])

        if (!healthResponse.ok) throw new Error('API unavailable')

        if (isCurrent) {
          setApiOnline(true)
          setProjects(savedProjects)
          setActiveProjectId((currentId) =>
            savedProjects.some((project) => project.id === currentId)
              ? currentId
              : (savedProjects[0]?.id ?? ''),
          )
          setRequestError('')
          if (savedProjects.length === 0) setIsLoading(false)
        }
      } catch {
        if (isCurrent) {
          setApiOnline(false)
          setRequestError(
            'Projects could not be loaded. Check that the API and database are running.',
          )
          setIsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      isCurrent = false
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setNotifications([])
      setUnreadCount(0)
      return
    }

    let isCurrent = true

    async function loadProfile() {
      try {
        const saved = await profileApi.get()
        if (isCurrent) setProfile(saved)
      } catch {
        if (isCurrent) setProfile(null)
      }
    }

    async function loadNotifications() {
      try {
        const saved = await notificationsApi.list()
        if (!isCurrent) return
        setNotifications(saved.items)
        setUnreadCount(saved.unreadCount)
      } catch {
        // Keep the last list when a refresh fails.
      }
    }

    void loadProfile()
    void loadNotifications()
    const timer = window.setInterval(() => void loadNotifications(), 15000)

    return () => {
      isCurrent = false
      window.clearInterval(timer)
    }
  }, [user])

  useEffect(() => {
    if (!activeProjectId) return

    let isCurrent = true

    async function loadProjectData() {
      setIsLoading(true)

      try {
        const [tasksResult, membersResult, rolesResult] = await Promise.allSettled([
          tasksApi.list(activeProjectId),
          projectsApi.listMembers(activeProjectId),
          projectsApi.listRoles(activeProjectId),
        ])

        if (isCurrent) {
          setTasks(tasksResult.status === 'fulfilled' ? tasksResult.value : [])
          setMembers(membersResult.status === 'fulfilled' ? membersResult.value : [])
          setRoles(rolesResult.status === 'fulfilled' ? rolesResult.value : [])
          setRequestError(
            tasksResult.status === 'rejected'
              ? 'The selected project could not be loaded.'
              : '',
          )
        }
      } catch {
        if (isCurrent) {
          setRequestError('The selected project could not be loaded.')
        }
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadProjectData()

    return () => {
      isCurrent = false
    }
  }, [activeProjectId])

  useEffect(() => {
    setBoardFilters(emptyBoardFilters)
    setCommentingTask(null)
  }, [activeProjectId])

  useEffect(() => {
    if (section !== 'my-tasks') return

    let isCurrent = true
    setIsAssignedLoading(true)

    async function loadAssignedTasks() {
      try {
        const savedTasks = await tasksApi.mine()
        if (!isCurrent) return
        setAssignedTasks(savedTasks)
        setRequestError('')
      } catch {
        if (isCurrent) setRequestError('Your tasks could not be loaded.')
      } finally {
        if (isCurrent) setIsAssignedLoading(false)
      }
    }

    void loadAssignedTasks()

    return () => {
      isCurrent = false
    }
  }, [section])

  useEffect(() => {
    if (section !== 'messages' || !activeProjectId) return

    let isCurrent = true
    setConversations([])
    setActiveConversationId('')
    setMessages([])

    async function loadConversations(announceError: boolean) {
      try {
        const savedConversations = await messagesApi.listConversations(activeProjectId)
        if (!isCurrent) return
        setConversations(savedConversations)
        setActiveConversationId((currentId) =>
          savedConversations.some((conversation) => conversation.id === currentId)
            ? currentId
            : (savedConversations[0]?.id ?? ''),
        )
        setRequestError('')
      } catch {
        if (isCurrent && announceError) setRequestError('Chats could not be loaded.')
      }
    }

    void loadConversations(true)
    const refreshId = window.setInterval(() => void loadConversations(false), 8000)

    return () => {
      isCurrent = false
      window.clearInterval(refreshId)
    }
  }, [activeProjectId, section])

  useEffect(() => {
    if (section !== 'messages' || !activeProjectId || !activeConversationId) return

    let isCurrent = true

    async function loadMessages(showLoading: boolean) {
      if (showLoading) {
        setMessages([])
        setIsMessagesLoading(true)
      }

      try {
        const savedMessages = await messagesApi.list(
          activeProjectId,
          activeConversationId,
        )
        if (isCurrent) {
          setMessages(savedMessages)
          setRequestError('')
        }
      } catch {
        if (isCurrent) setRequestError('Messages could not be loaded.')
      } finally {
        if (isCurrent && showLoading) setIsMessagesLoading(false)
      }
    }

    void loadMessages(true)
    const refreshId = window.setInterval(() => void loadMessages(false), 8000)

    return () => {
      isCurrent = false
      window.clearInterval(refreshId)
    }
  }, [activeConversationId, activeProjectId, section])

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? null

  async function moveTask(taskId: number, status: TaskStatus) {
    const task = tasks.find((currentTask) => currentTask.id === taskId)
    if (!task || !activeProjectId) return

    try {
      const updatedTask = await tasksApi.update(
        activeProjectId,
        taskId,
        taskToInput(task, status),
      )
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === taskId ? updatedTask : currentTask,
        ),
      )
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === activeProjectId
            ? applyTaskCountChange(project, {
                from: task.status,
                to: updatedTask.status,
              })
            : project,
        ),
      )
      setRequestError('')
    } catch {
      setRequestError('The task could not be moved.')
    }
  }

  const draggedTask =
    tasks.find((task) => task.id === draggedTaskId) ?? null

  function handleDragStart(event: DragStartEvent) {
    const taskId = event.active.data.current?.taskId
    setDraggedTaskId(typeof taskId === 'number' ? taskId : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedTaskId(null)
    const taskId = event.active.data.current?.taskId
    const status = event.over?.id

    if (
      typeof taskId !== 'number' ||
      typeof status !== 'string' ||
      !columns.some((column) => column.id === status)
    ) {
      return
    }

    const task = tasks.find((currentTask) => currentTask.id === taskId)
    if (task?.status !== status) void moveTask(taskId, status as TaskStatus)
  }

  function openNewTaskForm() {
    setEditingTask(null)
    setIsTaskFormOpen(true)
  }

  function openEditTaskForm(task: Task) {
    setEditingTask(task)
    setIsTaskFormOpen(true)
  }

  function closeTaskForm() {
    setIsTaskFormOpen(false)
    setEditingTask(null)
  }

  async function saveTask(taskInput: TaskInput) {
    if (!activeProjectId) throw new Error('Select a project first')

    if (editingTask) {
      const updatedTask = await tasksApi.update(
        activeProjectId,
        editingTask.id,
        taskInput,
      )
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === editingTask.id ? updatedTask : task,
        ),
      )
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === activeProjectId
            ? applyTaskCountChange(project, {
                from: editingTask.status,
                to: updatedTask.status,
              })
            : project,
        ),
      )
    } else {
      const createdTask = await tasksApi.create(activeProjectId, taskInput)
      setTasks((currentTasks) => [...currentTasks, createdTask])
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === activeProjectId
            ? applyTaskCountChange(project, { to: createdTask.status })
            : project,
        ),
      )
    }

    setRequestError('')
  }

  async function deleteTask(taskToDelete: Task) {
    const shouldDelete = window.confirm(
      `Delete "${taskToDelete.title}"? This cannot be undone.`,
    )

    if (shouldDelete) {
      try {
        await tasksApi.remove(activeProjectId, taskToDelete.id)
        setTasks((currentTasks) =>
          currentTasks.filter((task) => task.id !== taskToDelete.id),
        )
        setProjects((currentProjects) =>
          currentProjects.map((project) =>
            project.id === activeProjectId
              ? applyTaskCountChange(project, { from: taskToDelete.status })
              : project,
          ),
        )
        setRequestError('')
      } catch {
        setRequestError('The task could not be deleted.')
      }
    }
  }

  async function toggleBookmark(project: Project) {
    try {
      const updatedProject = await projectsApi.setBookmark(
        project.id,
        !project.bookmarked,
      )
      setProjects((currentProjects) =>
        currentProjects.map((currentProject) =>
          currentProject.id === project.id ? updatedProject : currentProject,
        ),
      )
      setRequestError('')
    } catch {
      setRequestError('The bookmark could not be saved.')
    }
  }

  async function sendMessage(body: string) {
    if (!activeProjectId || !activeConversationId) {
      throw new Error('Choose a chat first')
    }

    const message = await messagesApi.create(
      activeProjectId,
      activeConversationId,
      body,
    )
    setMessages((currentMessages) => [...currentMessages, message])
    setConversations((currentConversations) => {
      const match = currentConversations.find(
        (conversation) => conversation.id === activeConversationId,
      )
      if (!match) return currentConversations
      const updated = {
        ...match,
        updatedAt: message.createdAt,
        lastMessage: { body: message.body, createdAt: message.createdAt },
      }
      return [
        updated,
        ...currentConversations.filter(
          (conversation) => conversation.id !== activeConversationId,
        ),
      ]
    })
    setRequestError('')
  }

  async function leaveConversation(conversationId: string) {
    if (!activeProjectId) throw new Error('Select a project first')

    await messagesApi.leave(activeProjectId, conversationId)
    const remaining = conversations.filter(
      (conversation) => conversation.id !== conversationId,
    )
    setConversations(remaining)
    if (activeConversationId === conversationId) {
      setActiveConversationId(remaining[0]?.id ?? '')
      setMessages([])
    }
    setRequestError('')
  }

  async function deleteMessage(messageId: string) {
    if (!activeProjectId || !activeConversationId) {
      throw new Error('Choose a chat first')
    }

    await messagesApi.remove(activeProjectId, activeConversationId, messageId)
    const remaining = messages.filter((message) => message.id !== messageId)
    const latest = remaining[remaining.length - 1]
    setMessages(remaining)
    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              lastMessage: latest
                ? { body: latest.body, createdAt: latest.createdAt }
                : null,
            }
          : conversation,
      ),
    )
  }

  async function createConversation(input: {
    kind: 'direct' | 'group'
    name?: string
    memberIds?: string[]
    wholeProject?: boolean
  }) {
    if (!activeProjectId) throw new Error('Select a project first')

    const conversation = await messagesApi.createConversation(activeProjectId, input)
    setConversations((currentConversations) => [
      conversation,
      ...currentConversations.filter(
        (current) => current.id !== conversation.id,
      ),
    ])
    setActiveConversationId(conversation.id)
  }

  function dropProject(projectId: string) {
    const remaining = projects.filter((project) => project.id !== projectId)
    setProjects(remaining)
    if (activeProjectId === projectId) {
      setActiveProjectId(remaining[0]?.id ?? '')
    }
  }

  async function leaveProject() {
    if (!activeProject || activeProject.canManage) return

    const shouldLeave = window.confirm(
      `Leave "${activeProject.name}"? You will no longer see its tasks or messages.`,
    )
    if (!shouldLeave) return

    try {
      await projectsApi.leave(activeProject.id)
      dropProject(activeProject.id)
      setRequestError('')
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'The project could not be left.',
      )
    }
  }

  async function deleteProject() {
    if (!activeProject || !activeProject.canManage) return

    const shouldDelete = window.confirm(
      `Delete "${activeProject.name}"? This removes its tasks and messages for every member.`,
    )
    if (!shouldDelete) return

    try {
      await projectsApi.remove(activeProject.id)
      dropProject(activeProject.id)
      setRequestError('')
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'The project could not be deleted.',
      )
    }
  }

  async function createProject(input: {
    name: string
    description: string
  }) {
    const project = await projectsApi.create(input)
    setProjects((currentProjects) => [...currentProjects, project])
    setActiveProjectId(project.id)
    setSection('board')
  }

  function openProject(projectId: string) {
    setActiveProjectId(projectId)
    setSection('board')
  }

  async function saveProfile(input: { displayName: string; photo: ProfilePhotoUpdate }) {
    const saved = await profileApi.save(input)
    setProfile(saved)
    if (!user) return

    const apply = <T extends { id: string }>(person: T): T =>
      person.id === user.uid
        ? { ...person, displayName: saved.displayName, photoUrl: saved.photoUrl }
        : person

    setMembers((current) => current.map(apply))
    setTasks((current) =>
      current.map((task) => ({
        ...task,
        assignee: task.assignee ? apply(task.assignee) : null,
      })),
    )
    setAssignedTasks((current) =>
      current.map((task) => ({
        ...task,
        assignee: task.assignee ? apply(task.assignee) : null,
      })),
    )
    setConversations((current) =>
      current.map((conversation) => ({
        ...conversation,
        members: conversation.members.map(apply),
      })),
    )
    setMessages((current) =>
      current.map((message) => ({
        ...message,
        author: apply(message.author),
      })),
    )
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        actor: apply(notification.actor),
      })),
    )
  }

  async function openNotification(item: AppNotification) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === item.id && !notification.readAt
          ? { ...notification, readAt: new Date().toISOString() }
          : notification,
      ),
    )
    if (!item.readAt) setUnreadCount((count) => Math.max(0, count - 1))

    setActiveProjectId(item.projectId)
    if (item.kind === 'message' && item.conversationId) {
      setActiveConversationId(item.conversationId)
      setSection('messages')
    } else if (item.kind === 'call-invite') {
      setSection('call')
    } else {
      setSection('board')
    }

    if (!item.readAt) {
      try {
        await notificationsApi.markRead(item.id)
      } catch {
        // The next refresh restores the unread state if this fails.
      }
    }
  }

  async function markAllNotificationsRead() {
    setNotifications((current) =>
      current.map((notification) =>
        notification.readAt
          ? notification
          : { ...notification, readAt: new Date().toISOString() },
      ),
    )
    setUnreadCount(0)

    try {
      await notificationsApi.markAllRead()
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'Notifications could not be updated.',
      )
    }
  }

  function selectProject(projectId: string) {
    setActiveProjectId(projectId)
    if (section === 'home') setSection('board')
  }

  async function addRole(name: string) {
    if (!activeProjectId) throw new Error('Select a project first')

    const role = await projectsApi.createRole(activeProjectId, name)
    setRoles((currentRoles) =>
      [...currentRoles, role].sort(
        (left, right) =>
          Number(right.isManager) - Number(left.isManager) ||
          left.name.localeCompare(right.name),
      ),
    )
  }

  async function changeMemberRole(userId: string, roleId: string) {
    if (!activeProjectId) throw new Error('Select a project first')

    const updatedMember = await projectsApi.changeRole(
      activeProjectId,
      userId,
      roleId,
    )
    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === userId ? updatedMember : member,
      ),
    )

    if (user?.uid === userId) {
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === activeProjectId
            ? {
                ...project,
                role: updatedMember.role,
                canManage: updatedMember.canManage,
              }
            : project,
        ),
      )
    }
  }

  async function addMember(email: string) {
    if (!activeProjectId) throw new Error('Select a project first')

    const member = await projectsApi.addMember(activeProjectId, email)
    const isNewMember = !members.some((current) => current.id === member.id)

    setMembers((currentMembers) =>
      isNewMember ? [...currentMembers, member] : currentMembers,
    )

    if (isNewMember) {
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === activeProjectId
            ? { ...project, memberCount: project.memberCount + 1 }
            : project,
        ),
      )
    }
  }

  if (isAuthLoading) {
    return (
      <main className="auth-page">
        <p role="status">Checking your session...</p>
      </main>
    )
  }

  if (!user) return <AuthPage />

  const visibleProjects = sortProjects(projects, projectSort)
  const activeSortLabel =
    projectSorts.find((option) => option.id === projectSort)?.label ?? 'Name'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-bar">
        <a
          className="brand"
          href="/"
          aria-label="Parallel home"
          onClick={(event) => {
            event.preventDefault()
            setSection('home')
          }}
        >
          <span className="brand__mark">P</span>
          Parallel
        </a>
        <NotificationMenu
          unreadCount={unreadCount}
          items={notifications}
          onSelect={(item) => void openNotification(item)}
          onMarkAllRead={() => void markAllNotificationsRead()}
        />
        </div>

        <div className="project-switcher">
          <div className="project-toolbar">
            <p id="project-list-label">Projects</p>
            <div className="sort-menu">
              <button
                type="button"
                aria-expanded={isSortOpen}
                aria-haspopup="menu"
                onClick={() => setIsSortOpen((open) => !open)}
              >
                Sort: {activeSortLabel}
              </button>
              {isSortOpen && (
                <div className="sort-menu__options" role="menu">
                  {projectSorts.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={projectSort === option.id}
                      onClick={() => {
                        setProjectSort(option.id)
                        setIsSortOpen(false)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {visibleProjects.length === 0 ? (
            <p className="project-list__empty">No projects yet.</p>
          ) : (
            <ul className="project-list" aria-labelledby="project-list-label">
              {visibleProjects.map((project) => (
                <li
                  key={project.id}
                  className={
                    project.id === activeProjectId
                      ? 'project-row project-row--active'
                      : 'project-row'
                  }
                >
                  <button
                    className="project-row__select"
                    type="button"
                    aria-current={
                      project.id === activeProjectId ? 'true' : undefined
                    }
                    onClick={() => selectProject(project.id)}
                  >
                    {project.name}
                  </button>
                  <button
                    className={
                      project.bookmarked
                        ? 'project-row__bookmark project-row__bookmark--on'
                        : 'project-row__bookmark'
                    }
                    type="button"
                    aria-pressed={project.bookmarked}
                    aria-label={
                      project.bookmarked
                        ? `Remove bookmark from ${project.name}`
                        : `Bookmark ${project.name}`
                    }
                    onClick={() => void toggleBookmark(project)}
                  >
                    {project.bookmarked ? '★' : '☆'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="project-switcher__create"
            type="button"
            onClick={() => setIsProjectFormOpen(true)}
          >
            + New project
          </button>
        </div>

        <nav aria-label="Main navigation">
          <button
            className={
              section === 'home' ? 'nav-link nav-link--active' : 'nav-link'
            }
            type="button"
            onClick={() => setSection('home')}
          >
            Home
          </button>
          <button
            className={
              section === 'my-tasks' ? 'nav-link nav-link--active' : 'nav-link'
            }
            type="button"
            onClick={() => setSection('my-tasks')}
          >
            My tasks
          </button>
          <button
            className={
              section === 'board' ? 'nav-link nav-link--active' : 'nav-link'
            }
            type="button"
            onClick={() => setSection('board')}
          >
            Board
          </button>
          <button
            className={
              section === 'activity' ? 'nav-link nav-link--active' : 'nav-link'
            }
            type="button"
            onClick={() => setSection('activity')}
          >
            Activity
          </button>
          <button
            className={
              section === 'messages' ? 'nav-link nav-link--active' : 'nav-link'
            }
            type="button"
            onClick={() => setSection('messages')}
          >
            Messages
          </button>
          <button
            className={
              section === 'call' ? 'nav-link nav-link--active' : 'nav-link'
            }
            type="button"
            onClick={() => setSection('call')}
          >
            Call
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="account">
            <button
              className="account__profile"
              type="button"
              onClick={() => setIsProfileOpen(true)}
            >
              <Avatar
                person={{
                  displayName: profile?.displayName ?? null,
                  email: profile?.email ?? user.email ?? '',
                  photoUrl: profile?.photoUrl ?? null,
                }}
              />
              <span>
                <strong>{personName({
                  displayName: profile?.displayName ?? null,
                  email: user.email ?? '',
                })}</strong>
                <span className="account__email">{user.email}</span>
              </span>
            </button>
            <button type="button" onClick={() => void signOut(auth)}>
              Sign out
            </button>
          </div>
          <div className="api-status">
            <span
              className={
                apiOnline ? 'status-dot status-dot--online' : 'status-dot'
              }
            />
            API {apiOnline ? 'connected' : 'offline'}
          </div>
        </div>
      </aside>

      <main>
        <header className="page-header">
          <div>
            <p className="eyebrow">{pageHeading(section, activeProject).eyebrow}</p>
            <h1>{pageHeading(section, activeProject).title}</h1>
            {pageHeading(section, activeProject).description && (
              <p className="project-description">
                {pageHeading(section, activeProject).description}
              </p>
            )}
          </div>
          <div className="page-tools">
          {(section === 'board' || section === 'messages' || section === 'activity') && (
          <div className="page-actions">
            {activeProject && !activeProject.canManage && (
              <button
                className="danger-button"
                type="button"
                onClick={() => void leaveProject()}
              >
                Leave project
              </button>
            )}
            {activeProject?.canManage && (
              <button
                className="danger-button"
                type="button"
                onClick={() => void deleteProject()}
              >
                Delete project
              </button>
            )}
            <button
              className="secondary-button"
              type="button"
              disabled={!activeProject}
              onClick={() => setIsMembersOpen(true)}
            >
              Members ({activeProject?.memberCount ?? 0})
            </button>
            {section === 'board' && (
              <button
                className="primary-button"
                type="button"
                disabled={!activeProject}
                onClick={openNewTaskForm}
              >
                + Add task
              </button>
            )}
          </div>
          )}
          </div>
        </header>

        {requestError && (
          <p className="request-error" role="alert">
            {requestError}
          </p>
        )}

        {isLoading && section === 'home' && projects.length === 0 && (
          <p className="loading-message" role="status">
            Loading projects...
          </p>
        )}

        {section === 'home' && projects.length > 0 && (
          <HomePanel
            projects={visibleProjects}
            onOpenProject={openProject}
            onToggleBookmark={(project) => void toggleBookmark(project)}
            onCreateProject={() => setIsProjectFormOpen(true)}
          />
        )}

        {section === 'home' && !requestError && !isLoading && projects.length === 0 && (
          <HomePanel
            projects={[]}
            onOpenProject={openProject}
            onToggleBookmark={(project) => void toggleBookmark(project)}
            onCreateProject={() => setIsProjectFormOpen(true)}
          />
        )}

        {isAssignedLoading && section === 'my-tasks' && assignedTasks.length === 0 && (
          <p className="loading-message" role="status">
            Loading your tasks...
          </p>
        )}

        {section === 'my-tasks' && !(isAssignedLoading && assignedTasks.length === 0) && (
          <MyTasksPanel
            tasks={assignedTasks}
            isLoading={isAssignedLoading}
            onOpenTask={(task) => openProject(task.projectId)}
          />
        )}

        {isLoading && section === 'board' && (
          <p className="loading-message" role="status">
            Loading tasks...
          </p>
        )}

        {section === 'activity' && !activeProject && (
          <p className="loading-message" role="status">
            Select a project to see its activity.
          </p>
        )}

        {section === 'activity' && activeProject && (
          <ActivityPanel key={activeProject.id} projectId={activeProject.id} />
        )}

        {section === 'call' && !activeProject && (
          <p className="loading-message" role="status">
            Select a project to start a call room.
          </p>
        )}

        {section === 'call' && activeProject && user && (
          <CallPanel
            key={activeProject.id}
            projectId={activeProject.id}
            projectName={activeProject.name}
            members={members}
            currentUserId={user.uid}
          />
        )}

        {section === 'messages' && activeProject && user && (
          <MessagesPanel
            key={activeProject.id}
            conversations={conversations}
            activeConversationId={activeConversationId}
            messages={messages}
            members={members}
            currentUserId={user.uid}
            isLoading={isMessagesLoading}
            onSelect={setActiveConversationId}
            canManage={activeProject.canManage}
            onCreate={createConversation}
            onSend={sendMessage}
            onLeave={(conversationId) => leaveConversation(conversationId)}
            onDelete={deleteMessage}
          />
        )}

        {section === 'board' && (
        <>
        <BoardFilters
          members={members}
          filters={boardFilters}
          onChange={setBoardFilters}
        />
        {tasks.length > 0 &&
          filterBoardTasks(tasks, boardFilters).length === 0 && (
            <p className="board-filters__empty">No tasks match these filters.</p>
          )}
        <DndContext
          sensors={dragSensors}
          autoScroll={{
            canScroll(element) {
              return element.classList.contains('board')
            },
          }}
          onDragStart={handleDragStart}
          onDragCancel={() => setDraggedTaskId(null)}
          onDragEnd={handleDragEnd}
        >
          <section className="board" id="board" aria-label="Project task board">
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                tasks={filterBoardTasks(tasks, boardFilters).filter(
                  (task) => task.status === column.id,
                )}
                onMoveTask={moveTask}
                onEditTask={openEditTaskForm}
                onDeleteTask={deleteTask}
                onCommentTask={setCommentingTask}
              />
            ))}
          </section>
          <DragOverlay>
            {draggedTask ? <TaskCardPreview task={draggedTask} /> : null}
          </DragOverlay>
        </DndContext>
        </>
        )}
      </main>

      {isProfileOpen && user.email && (
        <ProfileModal
          profile={
            profile ?? {
              uid: user.uid,
              email: user.email,
              displayName: null,
              photoUrl: null,
            }
          }
          onClose={() => setIsProfileOpen(false)}
          onSave={saveProfile}
        />
      )}

      {commentingTask && activeProject && user && (
        <TaskCommentsModal
          projectId={activeProject.id}
          task={commentingTask}
          currentUserId={user.uid}
          onClose={() => setCommentingTask(null)}
        />
      )}

      {isTaskFormOpen && (
        <TaskFormModal
          task={editingTask}
          members={members}
          onClose={closeTaskForm}
          onSave={saveTask}
        />
      )}

      {isProjectFormOpen && (
        <ProjectFormModal
          onClose={() => setIsProjectFormOpen(false)}
          onSave={createProject}
        />
      )}

      {isMembersOpen && activeProject && (
        <MembersModal
          members={members}
          canManage={activeProject.canManage}
          roles={roles}
          onClose={() => setIsMembersOpen(false)}
          onAddMember={addMember}
          onAddRole={addRole}
          onChangeRole={changeMemberRole}
        />
      )}
    </div>
  )
}

export default App
