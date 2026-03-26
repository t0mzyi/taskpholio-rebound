"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, MoreHorizontal, MessageSquare, Paperclip, 
  ChevronDown, ChevronUp, CheckCircle2, Clock, Play, 
  Flag, Users, Tag
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useTaskStore } from "@/store/taskStore";
import { toast } from "sonner";
import Image from "next/image";
import "./TaskCard.css";

interface TaskCardProps {
  task: any;
  view?: "grid" | "list";
}

export default function TaskCard({ task, view = "grid" }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { updateTaskStatus } = useTaskStore();
  const statusOrder = { pending: 0, "in-progress": 1, completed: 2 } as const;
  const normalizedStatus = task.status === "completed" || task.status === "in-progress" ? task.status : "pending";
  const currentStatusOrder = statusOrder[normalizedStatus as keyof typeof statusOrder];

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTaskStatus(task._id, newStatus as any);
      toast.success(`Task status updated to ${newStatus}.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update task status.");
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`task-card priority-${task.priority || 'medium'}`}
    >
      <div className="d-flex flex-col gap-4">
        {/* Header: Priority and Meta */}
        <div className="task-header">
          <div className="task-badges">
            <span className={`task-badge priority-${task.priority || 'medium'}`}>
              {task.priority || "Medium"} Priority
            </span>
            {task.team && (
              <span className="task-badge team-badge">
                <Users size={12} />
                {task.team.name}
              </span>
            )}
          </div>
          <button className="btn-icon">
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* Title and Description */}
        <div>
          <h4 className="task-title">
            {task.title}
          </h4>
          {task.description && (
            <p className={`task-description ${expanded ? 'expanded' : ''}`}>
              {task.description}
            </p>
          )}
        </div>

        {/* Progress Tracker */}
        <div className="task-progress-section">
          <div className="task-progress-header">
            <span style={{ color: 'var(--text-secondary)' }}>Task Progress</span>
            <span style={{ color: task.progress >= 100 ? 'var(--text-accent)' : 'var(--info)' }}>{task.progress || 0}%</span>
          </div>
          <div className="task-progress-bar-bg">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${task.progress || 0}%` }}
              className={`task-progress-bar-fill ${(task.progress || 0) >= 100 ? 'completed' : ''}`}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="task-footer">
          <div className="task-meta">
            <div className="task-meta-item">
              <Calendar size={14} />
              {task.dueDate ? formatDate(task.dueDate) : "No Due Date"}
            </div>
            {task.comments?.length > 0 && (
              <div className="task-meta-item">
                <MessageSquare size={14} />
                {task.comments.length}
              </div>
            )}
            {task.attachments?.length > 0 && (
              <div className="task-meta-item">
                <Paperclip size={14} />
                {task.attachments.length}
              </div>
            )}
          </div>

          <div className="d-flex align-center gap-3">
            {task.assignedTo && (
              <div className="task-assignee" title={task.assignedTo.name}>
                {task.assignedTo.avatar ? (
                  <Image src={task.assignedTo.avatar} alt={task.assignedTo.name} width={32} height={32} />
                ) : (
                  <span>{task.assignedTo.name?.[0]?.toUpperCase()}</span>
                )}
              </div>
            )}
            <button 
              onClick={() => setExpanded(!expanded)}
              className="btn-icon"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="task-expanded-content"
            >
              {/* Subtasks */}
              {task.subtasks?.length > 0 && (
                <div>
                  <h5 className="task-section-title">
                    <CheckCircle2 size={14} />
                    Subtasks
                  </h5>
                  <div>
                    {task.subtasks.map((st: any, idx: number) => (
                      <div key={idx} className={`subtask-item ${st.completed ? 'completed' : ''}`}>
                        <div className="subtask-item-icon">
                          {st.completed && <CheckCircle2 size={10} />}
                        </div>
                        <span>{st.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {task.tags?.length > 0 && (
                <div>
                  <h5 className="task-section-title">
                    <Tag size={14} />
                    Tags
                  </h5>
                  <div className="task-badges">
                    {task.tags.map((tag: string) => (
                      <span key={tag} className="tag-badge" style={{ backgroundColor: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Update */}
              <div>
                <h5 className="task-section-title">
                  <Flag size={14} />
                  Update Status
                </h5>
                <div className="status-buttons">
                  {[
                    { id: 'pending', label: 'Started', icon: <Clock size={12} /> },
                    { id: 'in-progress', label: 'In Progress', icon: <Play size={12} /> },
                    { id: 'completed', label: 'Completed', icon: <CheckCircle2 size={12} /> }
                  ].map((status) => (
                    (() => {
                      const stepOrder = statusOrder[status.id as keyof typeof statusOrder];
                      const isCurrentStatus = normalizedStatus === status.id;
                      const isPastStatus = stepOrder < currentStatusOrder;
                      const isDisabled = isCurrentStatus || isPastStatus;

                      return (
                        <button
                          key={status.id}
                          onClick={() => handleStatusChange(status.id)}
                          disabled={isDisabled}
                          className={`status-btn ${isCurrentStatus ? 'active' : ''}`}
                        >
                          {status.icon}
                          {status.label}
                        </button>
                      );
                    })()
                  ))}
                </div>
              </div>

              {/* Action Link */}
              <button className="task-details-btn">
                View Task Details
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
