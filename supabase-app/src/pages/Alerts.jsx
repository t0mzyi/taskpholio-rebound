import React, { useState } from 'react'
import {
  RiBellLine, RiTaskLine, RiCheckboxCircleLine,
  RiUserAddLine, RiCalendarEventLine, RiCheckDoubleLine, RiDeleteBinLine
} from 'react-icons/ri'
import { useNotifications } from '../context/NotificationContext'
import EmptyState from '../components/ui/EmptyState'
import '../styles/alerts.css'

const TYPE_CONFIG = {
  task_assigned:   { Icon: RiTaskLine,            bg: 'var(--accent-dim)',   color: 'var(--accent)' },
  task_updated:    { Icon: RiTaskLine,            bg: 'var(--blue-dim)',     color: 'var(--blue)' },
  task_completed:  { Icon: RiCheckboxCircleLine,  bg: 'var(--success-dim)',  color: 'var(--success)' },
  member_added:    { Icon: RiUserAddLine,          bg: 'var(--lime-dim)',     color: 'var(--lime)' },
  meeting_scheduled: { Icon: RiCalendarEventLine, bg: 'var(--warning-dim)',  color: 'var(--warning)' },
}

const TABS = [
  { label: 'All',       value: 'all' },
  { label: 'Tasks',     value: 'task' },
  { label: 'Members',   value: 'member' },
  { label: 'Meetings',  value: 'meeting' },
]

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function matchesTab(tab, type) {
  if (tab === 'all') return true
  if (tab === 'task') return type.startsWith('task')
  if (tab === 'member') return type === 'member_added'
  if (tab === 'meeting') return type === 'meeting_scheduled'
  return true
}

export default function Alerts() {
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications()
  const [tab, setTab] = useState('all')

  const filtered = notifications.filter(n => matchesTab(tab, n.type))

  return (
    <>
      <div className="alerts-header">
        <div>
          <h1 className="page-title">
            Alerts
            {unreadCount > 0 && (
              <span style={{ marginLeft: 10, background: 'var(--accent)', color: '#000', fontFamily: 'var(--font-data)', fontSize: 12, padding: '2px 8px', borderRadius: 10, verticalAlign: 'middle' }}>
                {unreadCount} new
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Your workspace notifications</p>
        </div>
        <div className="alerts-header-actions">
          {unreadCount > 0 && (
            <button className="btn-outline" onClick={markAllRead}>
              <RiCheckDoubleLine size={15} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="btn-danger" onClick={clearAll}>
              <RiDeleteBinLine size={15} /> Clear all
            </button>
          )}
        </div>
      </div>

      <div className="alerts-filter-bar">
        {TABS.map(t => (
          <button key={t.value} className={`filter-tab ${tab === t.value ? 'active' : ''}`} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={RiBellLine} title="All caught up" body="No notifications in this category." />
      ) : (
        <div className="alerts-list">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? { Icon: RiBellLine, bg: 'var(--bg-card-alt)', color: 'var(--text-secondary)' }
            return (
              <div
                key={n.id}
                className={`notif-row ${!n.read ? 'notif-row--unread' : ''}`}
                onClick={() => { if (!n.read) markRead(n.id) }}
              >
                <div className="notif-row__icon" style={{ background: cfg.bg }}>
                  <cfg.Icon size={16} color={cfg.color} />
                </div>
                <div className="notif-row__content">
                  <div className="notif-row__title">{n.title}</div>
                  {n.body && <div className="notif-row__body">{n.body}</div>}
                  <div className="notif-row__time">{relativeTime(n.created_at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
