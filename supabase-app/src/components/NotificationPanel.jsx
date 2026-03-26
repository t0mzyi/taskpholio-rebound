import React from 'react'
import {
  RiCheckDoubleLine, RiDeleteBinLine, RiFileList3Line, RiCalendarEventLine, RiInformationLine
} from 'react-icons/ri'
import { useNotifications } from '../context/NotificationContext'
import '../styles/components.css'

function getIcon(type) {
  switch (type) {
    case 'task': return <RiFileList3Line size={18} color="var(--info)" />
    case 'meeting': return <RiCalendarEventLine size={18} color="var(--accent)" />
    default: return <RiInformationLine size={18} color="var(--text-secondary)" />
  }
}

function getBg(type) {
  switch (type) {
    case 'task': return 'var(--info-dim)'
    case 'meeting': return 'var(--accent-dim)'
    default: return 'var(--bg-elevated)'
  }
}

function timeAgo(dateString) {
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return ''
  const s = Math.floor((new Date() - d) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

export default function NotificationPanel({ onClose }) {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications()

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <div className="notif-panel-title">Notifications {unreadCount > 0 && `(${unreadCount})`}</div>
        <div className="notif-panel-actions">
          {unreadCount > 0 && (
            <button className="btn-ghost notif-panel-action-btn" onClick={markAllRead}>
              <RiCheckDoubleLine size={13} style={{ marginRight: 4 }} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="btn-ghost notif-panel-action-btn danger" onClick={clearAll}>
              <RiDeleteBinLine size={13} style={{ marginRight: 4 }} /> Clear all
            </button>
          )}
        </div>
      </div>

      <div className="notif-list">
        {notifications.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 120 }}>
            <p>You're all caught up!</p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`} onClick={() => { if (!n.read) markRead(n.id) }}>
              <div className="notif-icon-box" style={{ background: getBg(n.type) }}>
                {getIcon(n.type)}
              </div>
              <div className="notif-content">
                <div className="notif-title">{n.title}</div>
                <div className="notif-message">{n.message}</div>
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
