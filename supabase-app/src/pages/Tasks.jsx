import React, { useState, useEffect, useCallback } from 'react'
import {
  RiAddLine, RiDeleteBin7Line, RiTaskLine
} from 'react-icons/ri'
import { useAuth } from '../context/AuthContext'
import { useRole } from '../hooks/useRole'
import { useRealtime } from '../hooks/useRealtime'
import { fetchTasks, createTask, updateTask, deleteTask } from '../lib/taskService'
import { fetchMembers } from '../lib/memberService'
import { PriorityBadge, StatusBadge } from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import '../styles/tasks.css'

const TABS = [
  { label: 'All',         value: 'all' },
  { label: 'Pending',     value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'My Tasks',    value: 'mine' },
]

const STATUS_STEPS = [
  { label: 'Started', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
]

const STATUS_STEP_ORDER = { pending: 0, in_progress: 1, completed: 2 }

const TEAMS = [
  { value: 'technical_engine', label: 'Technical Engine' },
  { value: 'security_auth',    label: 'Security & Auth' },
  { value: 'social_marketing', label: 'Social & Marketing' },
]

function isOverdue(dueDate) { return dueDate && new Date(dueDate) < new Date() }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function normalizeTaskStep(status) {
  if (status === 'completed') return 'completed'
  if (status === 'in_progress' || status === 'in-progress') return 'in_progress'
  return 'pending'
}
function isBackwardTransition(currentStatus, nextStatus) {
  return STATUS_STEP_ORDER[nextStatus] < STATUS_STEP_ORDER[currentStatus]
}

export default function Tasks() {
  const { user } = useAuth()
  const { isAdmin } = useRole()
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [statusError, setStatusError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assignMode, setAssignMode] = useState('team')
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('technical_engine')
  const [visibility, setVisibility] = useState('team')
  const [dueDate, setDueDate] = useState('')

  const loadTasks = useCallback(async () => {
    try {
      const filters = {}
      if (tab !== 'all' && tab !== 'mine') filters.status = tab
      if (tab === 'mine') filters.assignedTo = user?.id
      const data = await fetchTasks(filters)
      setTasks((data ?? []).filter(t => normalizeTaskStep(t.status) !== 'completed'))
    } catch (e) {
      console.error('fetchTasks error', e)
    } finally {
      setLoading(false)
    }
  }, [tab, user?.id])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => { if (isAdmin) fetchMembers().then(setMembers).catch(console.error) }, [isAdmin])
  useRealtime('tasks-page', 'tasks', null, loadTasks)

  const filtered = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))

  const openNew = () => {
    setTitle(''); setDescription(''); setPriority('medium')
    setAssignMode('team'); setSelectedMember(''); setSelectedTeam('technical_engine')
    setVisibility('team'); setDueDate(''); setFormError('')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!title.trim()) { setFormError('Title is required.'); return }
    setFormError('')
    setSubmitting(true)
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || null,
        status: 'pending',
        priority,
        assigned_to: assignMode === 'member' ? selectedMember || null : null,
        assigned_team: assignMode === 'team' ? selectedTeam : null,
        visibility,
        due_date: dueDate || null,
        created_by: user?.id,
      })
      setModalOpen(false)
      loadTasks()
    } catch (e) {
      setFormError(e.message ?? 'Failed to create task.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (task, newStatus) => {
    const currentStatus = normalizeTaskStep(task.status)
    if (currentStatus === newStatus) return
    if (isBackwardTransition(currentStatus, newStatus)) return

    setStatusError('')
    try {
      const updatedTask = await updateTask(task.id, { status: newStatus })
      setTasks(prev =>
        prev
          .map(t => t.id === task.id ? { ...t, ...updatedTask } : t)
          .filter(t => normalizeTaskStep(t.status) !== 'completed')
      )
    } catch (e) {
      console.error('Status update error', e)
      setStatusError(e?.message ?? 'Unable to update task progress.')
    }
  }

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task permanently?')) return
    try {
      await deleteTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (e) {
      console.error('Delete error', e)
    }
  }

  return (
    <>
      <div className="tasks-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {tasks.length} total tasks across all teams
          </p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={openNew}>
            <RiAddLine size={15} /> New Task
          </button>
        )}
      </div>

      <div className="tasks-filter-bar">
        {TABS.map(t => (
          <button
            key={t.value}
            className={`filter-tab ${tab === t.value ? 'active' : ''}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
        <div className="filter-tab-spacer" />
        <input
          className="task-search"
          placeholder="Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {statusError && (
        <p className="form-error" style={{ marginBottom: 10 }}>{statusError}</p>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={RiTaskLine} title="No tasks found" body="Try a different filter or create a new task." />
      ) : (
        <div className="task-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Title</th>
                <th>Assignee</th>
                <th>Team</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const canEdit = isAdmin || t.assigned_to === user?.id
                const overdue = isOverdue(t.due_date)
                const normalizedStatus = normalizeTaskStep(t.status)
                const currentStepIndex = STATUS_STEP_ORDER[normalizedStatus]
                return (
                  <tr key={t.id}>
                    <td><span className="task-row-num">{i + 1}</span></td>
                    <td>
                      <div className="task-title-cell">{t.title}</div>
                      {t.description && <div className="task-description-sub">{t.description}</div>}
                    </td>
                    <td>
                      {t.assignee ? (
                        <div className="assignee-cell">
                          <Avatar name={t.assignee.full_name} team={t.assignee.team} size={24} />
                          <span style={{ fontSize: 12 }}>{t.assignee.full_name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-data)' }}>
                      {t.assigned_team?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td>
                      {canEdit ? (
                        <div className="task-step-group">
                          {STATUS_STEPS.map(step => {
                            const stepIndex = STATUS_STEP_ORDER[step.value]
                            const isCurrent = step.value === normalizedStatus
                            const isPast = stepIndex < currentStepIndex
                            const isDisabled = isCurrent || isPast

                            return (
                              <button
                                key={`${t.id}-${step.value}`}
                                type="button"
                                className={`task-step-btn ${isCurrent ? 'active' : ''}`}
                                disabled={isDisabled}
                                onClick={() => handleStatusChange(t, step.value)}
                              >
                                {step.label}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <StatusBadge status={normalizedStatus} />
                      )}
                    </td>
                    <td>
                      <span className={`task-due-date ${overdue ? 'overdue' : ''}`}>
                        {t.due_date ? fmtDate(t.due_date) : '—'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="task-actions-cell">
                          <button className="btn-icon danger" onClick={() => handleDelete(t.id)} title="Delete task">
                            <RiDeleteBin7Line size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Task"
        width={520}
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </>
        }
      >
        {formError && <div className="login-error" style={{ marginBottom: 16 }}>{formError}</div>}
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Details..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-input form-select" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Visibility</label>
            <select className="form-input form-select" value={visibility} onChange={e => setVisibility(e.target.value)}>
              <option value="team">Team</option>
              <option value="all">Everyone</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Assign To</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className={`filter-tab ${assignMode === 'team' ? 'active' : ''}`} type="button" onClick={() => setAssignMode('team')}>Team</button>
            <button className={`filter-tab ${assignMode === 'member' ? 'active' : ''}`} type="button" onClick={() => setAssignMode('member')}>Member</button>
          </div>
          {assignMode === 'team' ? (
            <select className="form-input form-select" value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
              {TEAMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          ) : (
            <select className="form-input form-select" value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
              <option value="">— Select member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Due Date</label>
          <input className="form-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </Modal>
    </>
  )
}
