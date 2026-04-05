"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { useAuthStore } from "@/store/authStore";
import { Task } from "@/lib/types";
import { formatDate, getDisplayName, getInitial, normalizeUserRole } from "@/lib/utils";
import { taskDescriptionPreview } from "@/lib/taskDescription";
import TaskBriefingView from "@/components/tasks/TaskBriefingView";
import CreateTaskModal from "@/components/tasks/CreateTaskModal";

const statusLabel = (status: Task["status"]) => {
  if (status === "in-progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "blocked") return "Review / QA";
  return "To Do";
};

const priorityLabel = (priority: Task["priority"]) => {
  if (priority === "urgent") return "Critical";
  return priority.charAt(0).toUpperCase() + priority.slice(1);
};

const priorityChipClass = (priority: Task["priority"]) => {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "primary";
  return "muted";
};

const statusChipClass = (status: Task["status"]) => {
  if (status === "completed") return "success";
  if (status === "in-progress") return "primary";
  if (status === "blocked") return "warning";
  return "muted";
};

const taskProgress = (task: Task) => {
  if (typeof task.progress === "number") return Math.max(0, Math.min(task.progress, 100));
  if (task.status === "completed") return 100;
  if (task.status === "in-progress") return 50;
  if (task.status === "blocked") return 20;
  return 0;
};

const assignmentLabel = (task: Task) => {
  if (task.assignmentType === "team") return "Team";
  if (task.assignmentType === "hybrid") return "Team + Member";
  return "Direct";
};

const assignmentChipClass = (task: Task) => {
  if (task.assignmentType === "team") return "scope-team";
  if (task.assignmentType === "hybrid") return "scope-hybrid";
  return "scope-direct";
};

const visibilityLabel = (task: Task) => {
  if (task.visibility === "all") return "Public";
  if (task.visibility === "team") return "Team";
  return "Private";
};

const compactTaskDescription = (description?: string) => {
  const preview = taskDescriptionPreview(description, 4).replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!preview) return "No briefing added yet.";
  if (preview.length <= 190) return preview;
  return `${preview.slice(0, 187)}...`;
};

type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";
type LaneKey = "pending" | "in-progress" | "blocked" | "completed";

const laneMeta: Record<LaneKey, { title: string; subtitle: string; dotClass: string }> = {
  pending: {
    title: "To Do",
    subtitle: "Ready to start",
    dotClass: "todo",
  },
  "in-progress": {
    title: "In Progress",
    subtitle: "Execution underway",
    dotClass: "progress",
  },
  blocked: {
    title: "Review / QA",
    subtitle: "Needs unblock or review",
    dotClass: "review",
  },
  completed: {
    title: "Done",
    subtitle: "Finished tasks",
    dotClass: "done",
  },
};

export default function TasksPage() {
  const { user } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  const normalizedRole = normalizeUserRole(user?.role);
  const canCreate = normalizedRole === "CEO" || normalizedRole === "CTO";
  const myTeamId = typeof user?.team === "string" ? user.team : user?.team?._id;

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (task.status === "cancelled") return false;

      const matchSearch =
        !search ||
        task.title.toLowerCase().includes(search) ||
        task.description.toLowerCase().includes(search) ||
        getDisplayName(task.assignedTo?.name, task.assignedTo?.email).toLowerCase().includes(search) ||
        (task.team?.name || "").toLowerCase().includes(search);

      const normalizedPriority = task.priority === "urgent" ? "critical" : task.priority;
      const matchPriority = priority === "all" || normalizedPriority === priority;

      return matchSearch && matchPriority;
    });
  }, [priority, query, tasks]);

  const directTasks = useMemo(() => {
    if (normalizedRole === "Member" && user?._id) {
      return filtered.filter((task) => task.assignedToId === user._id);
    }
    return filtered.filter((task) => task.assignmentType === "individual" || Boolean(task.assignedToId));
  }, [filtered, normalizedRole, user?._id]);

  const directTaskIds = useMemo(() => new Set(directTasks.map((task) => task._id)), [directTasks]);

  const teamTasks = useMemo(() => {
    if (normalizedRole === "Member" && myTeamId) {
      return filtered.filter(
        (task) => task.teamId === myTeamId && task.assignmentType !== "individual" && !directTaskIds.has(task._id)
      );
    }
    return filtered.filter((task) => task.assignmentType === "team" || task.assignmentType === "hybrid");
  }, [directTaskIds, filtered, myTeamId, normalizedRole]);

  const publicTasks = useMemo(() => {
    if (normalizedRole === "Member" && user?._id) {
      return filtered.filter(
        (task) => task.assignmentType === "individual" && task.visibility === "all" && task.assignedToId !== user._id
      );
    }
    return filtered.filter((task) => task.visibility === "all");
  }, [filtered, normalizedRole, user?._id]);

  const laneTasks = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

    return {
      pending: sorted.filter((task) => task.status === "pending"),
      "in-progress": sorted.filter((task) => task.status === "in-progress"),
      blocked: sorted.filter((task) => task.status === "blocked"),
      completed: sorted.filter((task) => task.status === "completed"),
    } as Record<LaneKey, Task[]>;
  }, [filtered]);

  const renderTaskCard = (task: Task) => {
    const ownerLabel =
      task.assignmentType === "team" && !task.assignedTo?.name && task.team?.name
        ? task.team.name
        : getDisplayName(task.assignedTo?.name, task.assignedTo?.email);

    return (
      <article key={task._id} className="saas-task-card" data-status={task.status}>
        <div className="saas-task-topline">
          <span className={`saas-chip scope ${assignmentChipClass(task)}`}>{assignmentLabel(task)}</span>
          <span className={`saas-chip ${task.visibility === "all" ? "primary" : "muted"}`}>{visibilityLabel(task)}</span>
        </div>

        <h4 className="saas-task-title">{task.title}</h4>
        <p className="saas-task-desc">{compactTaskDescription(task.description)}</p>

        <div className="saas-task-meta">
          <div className="saas-task-meta-owner">
            <span className="saas-user-dot">{getInitial(ownerLabel, task.assignedTo?.email)}</span>
            <span>{ownerLabel}</span>
          </div>
          <span className="saas-task-due-date">{task.dueDate ? formatDate(task.dueDate) : "No deadline"}</span>
        </div>

        <div className="saas-pill-row saas-task-pills">
          <span className={`saas-chip ${statusChipClass(task.status)}`}>{statusLabel(task.status)}</span>
          <span className={`saas-chip ${priorityChipClass(task.priority)}`}>{priorityLabel(task.priority)}</span>
        </div>

        <div className="saas-progress-row">
          <p className="saas-progress-label">Progress</p>
          <span className="saas-progress-value">{taskProgress(task)}%</span>
        </div>
        <div className="saas-progress-rail">
          <div className="saas-progress-fill" style={{ width: `${taskProgress(task)}%` }} />
        </div>

        <button type="button" className="saas-task-open" onClick={() => setPreviewTask(task)}>
          Open Task →
        </button>
      </article>
    );
  };

  return (
    <div className="saas-page">
      <header className="saas-header">
        <div>
          <p className="saas-heading-eyebrow">Task Board</p>
          <h1 className="saas-heading-title">Tasks</h1>
          <p className="saas-heading-subtitle">
            {directTasks.length} direct, {teamTasks.length} team, {publicTasks.length} public
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="saas-btn-primary">
            <Plus size={15} /> New Task
          </button>
        )}
      </header>

      <section className="saas-search-row">
        <label className="saas-inline-input" style={{ width: "min(100%, 460px)" }}>
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks..."
          />
        </label>

        <div className="saas-pill-row">
          {(["all", "critical", "high", "medium", "low"] as PriorityFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPriority(item)}
              className={`saas-filter-chip ${priority === item ? "active" : ""}`}
            >
              {item === "all" ? "All" : item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="saas-kanban-grid">
        {(Object.keys(laneMeta) as LaneKey[]).map((lane) => (
          <div key={lane} className="saas-glass saas-kanban-column">
            <div className="saas-kanban-head">
              <div className="saas-kanban-title-wrap">
                <span className={`saas-kanban-dot ${laneMeta[lane].dotClass}`} />
                <h3 className="saas-column-title">{laneMeta[lane].title}</h3>
              </div>
              <span className="saas-column-count">{laneTasks[lane].length}</span>
            </div>
            <p className="saas-kanban-subtitle">{laneMeta[lane].subtitle}</p>
            <div className="saas-task-stack saas-task-stack-kanban">
              {laneTasks[lane].length ? laneTasks[lane].map(renderTaskCard) : <p className="saas-empty">No tasks here.</p>}
            </div>
          </div>
        ))}
      </section>

      {showModal && <CreateTaskModal onClose={() => setShowModal(false)} />}

      {previewTask && (
        <div className="saas-task-preview-overlay" onClick={() => setPreviewTask(null)}>
          <section className="saas-glass saas-task-preview-modal" onClick={(event) => event.stopPropagation()}>
            <header className="saas-task-preview-head">
              <div>
                <p className="saas-heading-eyebrow">Task Preview</p>
                <h2 className="saas-task-preview-title">{previewTask.title}</h2>
                <p className="saas-task-preview-subtitle">
                  Shared with{" "}
                  {previewTask.assignmentType === "team" && previewTask.team?.name
                    ? previewTask.team.name
                    : getDisplayName(previewTask.assignedTo?.name, previewTask.assignedTo?.email)}
                </p>
              </div>
              <button type="button" className="saas-task-preview-close" onClick={() => setPreviewTask(null)}>
                <X size={16} />
              </button>
            </header>

            <div className="saas-task-preview-meta">
              <span className={`saas-chip ${statusChipClass(previewTask.status)}`}>{statusLabel(previewTask.status)}</span>
              <span className={`saas-chip ${priorityChipClass(previewTask.priority)}`}>{priorityLabel(previewTask.priority)}</span>
              <span className="saas-chip muted">{previewTask.dueDate ? formatDate(previewTask.dueDate) : "No deadline"}</span>
              <span className={`saas-chip ${previewTask.visibility === "all" ? "primary" : "muted"}`}>
                {visibilityLabel(previewTask)}
              </span>
            </div>

            <div className="saas-task-preview-body">
              <TaskBriefingView description={previewTask.description} />
            </div>

            <footer className="saas-task-preview-footer">
              <button type="button" className="saas-btn-secondary" onClick={() => setPreviewTask(null)}>
                Close
              </button>
              <Link href={`/dashboard/tasks/${previewTask._id}`} className="saas-btn-primary" onClick={() => setPreviewTask(null)}>
                Open Full Task
              </Link>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
