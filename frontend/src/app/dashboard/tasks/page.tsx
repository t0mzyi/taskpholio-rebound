"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { useAuthStore } from "@/store/authStore";
import { Task } from "@/lib/types";
import { formatDate, getDisplayName, getInitial, normalizeUserRole } from "@/lib/utils";
import CreateTaskModal from "@/components/tasks/CreateTaskModal";

const statusLabel = (status: Task["status"]) => {
  if (status === "in-progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "blocked") return "Blocked";
  return "Not Started";
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
  if (task.status === "blocked") return 15;
  return 0;
};

type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";

export default function TasksPage() {
  const { user } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  const normalizedRole = normalizeUserRole(user?.role);
  const canCreate = normalizedRole === "CEO" || normalizedRole === "CTO";
  const myTeamId = typeof user?.team === "string" ? user.team : user?.team?._id;

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (task.status === "completed") return false;

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

  const renderTaskCard = (task: Task) => (
    <article key={task._id} className="saas-task-card">
      <div className="saas-task-top">
        <h4 className="saas-task-title">{task.title}</h4>
        <span className={`saas-chip ${task.visibility === "all" ? "primary" : "muted"}`}>
          {task.visibility === "all" ? "Public" : task.visibility === "team" ? "Team" : "Private"}
        </span>
      </div>
      {task.description && <p className="saas-task-desc">{task.description}</p>}

      <div className="saas-task-meta">
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.32rem" }}>
          <span className="saas-user-dot">{getInitial(task.assignedTo?.name, task.assignedTo?.email)}</span>
          <span>{getDisplayName(task.assignedTo?.name, task.assignedTo?.email)}</span>
        </div>
        <span>{task.dueDate ? formatDate(task.dueDate) : "No deadline"}</span>
      </div>

      <div className="saas-pill-row" style={{ marginTop: "0.34rem" }}>
        <span className={`saas-chip ${statusChipClass(task.status)}`}>{statusLabel(task.status)}</span>
        <span className={`saas-chip ${priorityChipClass(task.priority)}`}>{priorityLabel(task.priority)}</span>
      </div>

      <p className="saas-progress-label">Progress</p>
      <div className="saas-progress-rail">
        <div className="saas-progress-fill" style={{ width: `${taskProgress(task)}%` }} />
      </div>

      <Link href={`/dashboard/tasks/${task._id}`} className="saas-task-open">
        Open Task →
      </Link>
    </article>
  );

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

      <section className="saas-page-grid-3">
        <div className="saas-glass saas-column-card">
          <div className="saas-column-head">
            <h3 className="saas-column-title">Directly Assigned to You</h3>
            <span className="saas-column-count">{directTasks.length}</span>
          </div>
          <div className="saas-task-stack">
            {directTasks.length ? directTasks.map(renderTaskCard) : <p className="saas-empty">No direct tasks found.</p>}
          </div>
        </div>

        <div className="saas-glass saas-column-card">
          <div className="saas-column-head">
            <h3 className="saas-column-title">Team-wide Tasks</h3>
            <span className="saas-column-count">{teamTasks.length}</span>
          </div>
          <div className="saas-task-stack">
            {teamTasks.length ? teamTasks.map(renderTaskCard) : <p className="saas-empty">No team tasks found.</p>}
          </div>
        </div>

        <div className="saas-glass saas-column-card">
          <div className="saas-column-head">
            <h3 className="saas-column-title">Public Member Tasks</h3>
            <span className="saas-column-count">{publicTasks.length}</span>
          </div>
          <div className="saas-task-stack">
            {publicTasks.length ? publicTasks.map(renderTaskCard) : <p className="saas-empty">No public tasks found.</p>}
          </div>
        </div>
      </section>

      {showModal && <CreateTaskModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
