import { supabase } from './supabase'

const TASK_FIELDS = 'id, title, description, status, priority, visibility, assigned_to, assigned_team, due_date, completed_at, created_at, updated_at, created_by'
const STATUS_STEP_ORDER = { pending: 0, in_progress: 1, completed: 2 }

function normalizeProgressStatus(status) {
  if (status === 'completed') return 'completed'
  if (status === 'in_progress' || status === 'in-progress') return 'in_progress'
  return 'pending'
}

function isBackwardProgressTransition(currentStatus, nextStatus) {
  return STATUS_STEP_ORDER[nextStatus] < STATUS_STEP_ORDER[currentStatus]
}

export async function fetchTasks(filters = {}) {
  let q = supabase
    .from('tasks')
    .select(`${TASK_FIELDS}, assignee:profiles!tasks_assigned_to_fkey(id, full_name, team, role)`)
    .order('created_at', { ascending: false })

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters.team) q = q.eq('assigned_team', filters.team)
  if (filters.assignedTo) q = q.eq('assigned_to', filters.assignedTo)
  if (filters.search) q = q.ilike('title', `%${filters.search}%`)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createTask(taskData) {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select(`${TASK_FIELDS}, assignee:profiles!tasks_assigned_to_fkey(id, full_name, team)`)
    .single()
  if (error) throw error

  // Notify assigned member
  if (task.assigned_to) {
    await supabase.from('notifications').insert({
      user_id: task.assigned_to,
      type: 'task_assigned',
      title: 'New task assigned to you',
      body: task.title,
      ref_id: task.id,
    })
  }

  // Notify all team members if team task
  if (task.assigned_team) {
    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('team', task.assigned_team)
      .neq('id', task.assigned_to ?? '')
    if (members?.length) {
      await supabase.from('notifications').insert(
        members.map(m => ({
          user_id: m.id,
          type: 'task_assigned',
          title: 'New task for your team',
          body: task.title,
          ref_id: task.id,
        }))
      )
    }
  }
  return task
}

export async function updateTask(id, updates) {
  const nextUpdates = { ...updates }

  if (typeof updates.status === 'string') {
    const nextStatus = normalizeProgressStatus(updates.status)
    if (nextStatus !== updates.status) {
      throw new Error('Only Started, In Progress, and Completed are allowed.')
    }

    const { data: currentTask, error: currentError } = await supabase
      .from('tasks')
      .select('status')
      .eq('id', id)
      .single()
    if (currentError) throw currentError

    const currentStatus = normalizeProgressStatus(currentTask?.status)
    if (isBackwardProgressTransition(currentStatus, nextStatus)) {
      throw new Error('Task progress cannot move backwards once advanced.')
    }

    if (currentStatus === nextStatus) {
      return fetchTaskById(id)
    }

    nextUpdates.status = nextStatus
    nextUpdates.completed_at = nextStatus === 'completed' ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(nextUpdates)
    .eq('id', id)
    .select(`${TASK_FIELDS}, assignee:profiles!tasks_assigned_to_fkey(id, full_name, team)`)
    .single()
  if (error) throw error

  // Notify task creator on completion
  if (nextUpdates.status === 'completed' && data.created_by && data.created_by !== data.assigned_to) {
    await supabase.from('notifications').insert({
      user_id: data.created_by,
      type: 'task_completed',
      title: 'Task completed',
      body: data.title,
      ref_id: data.id,
    })
  }
  return data
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function fetchTaskById(id) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`${TASK_FIELDS}, assignee:profiles!tasks_assigned_to_fkey(id, full_name, team)`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
