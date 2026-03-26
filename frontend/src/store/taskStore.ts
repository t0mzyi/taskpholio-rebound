"use client";
import { create } from "zustand";
import { Attachment, Comment, Subtask, Task, TeamProgressEntry, User } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { RealtimeChannel } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/pushNotifications";
import { normalizeUserRole } from "@/lib/utils";

interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  isLoading: boolean;
  lastFetch: number | null;
  filters: {
    status: string;
    priority: string;
    search: string;
  };
  fetchTasks: (force?: boolean, silent?: boolean, filters?: Record<string, string>) => Promise<void>;
  fetchTask: (id: string) => Promise<void>;
  createTask: (data: any) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTaskStatus: (id: string, status: Task["status"]) => Promise<void>;
  addTaskComment: (id: string, payload: { text: string; attachments?: Attachment[] }) => Promise<Task>;
  toggleSubtask: (id: string, subtaskId: string) => Promise<Task>;
  setFilters: (filters: Partial<TaskState["filters"]>) => void;
  getFilteredTasks: () => Task[];
  initRealtimeTasks: () => void;
}

let taskRealtimeChannel: RealtimeChannel | null = null;

const roleMap: Record<string, User["role"]> = {
  ceo: "CEO",
  cto: "CTO",
  member: "Member",
};

const OVERDUE_ALERT_TITLE = "Task overdue warning";
const OVERDUE_ALERT_ACTIVITY_ACTION = "overdue_alert_sent";

const normalizeStatusFromDb = (status: string): Task["status"] => {
  const value = (status || "").toLowerCase();
  if (value === "in_progress") return "in-progress";
  if (value === "blocked") return "blocked";
  if (value === "completed") return "completed";
  if (value === "cancelled") return "cancelled";
  return "pending";
};

const toDbStatus = (status: string): string => {
  const value = (status || "").toLowerCase();
  if (value === "in-progress") return "in_progress";
  if (value === "blocked") return "blocked";
  if (value === "completed") return "completed";
  if (value === "cancelled") return "blocked";
  return "pending";
};

const normalizePriorityFromDb = (priority: string): Task["priority"] => {
  const value = (priority || "").toLowerCase();
  if (value === "critical") return "urgent";
  if (value === "high") return "high";
  if (value === "low") return "low";
  return "medium";
};

const toDbPriority = (priority: string): string => {
  const value = (priority || "").toLowerCase();
  if (value === "urgent") return "critical";
  if (value === "high") return "high";
  if (value === "low") return "low";
  return "medium";
};

const progressFromStatus = (status: Task["status"]): number => {
  if (status === "completed") return 100;
  if (status === "in-progress") return 50;
  if (status === "blocked") return 20;
  return 0;
};

const statusLabel = (status: Task["status"]): string => {
  if (status === "in-progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "blocked") return "Blocked";
  if (status === "cancelled") return "Cancelled";
  return "Started";
};

type ProgressStatus = "pending" | "in-progress" | "completed";

const normalizeProgressStatus = (status: Task["status"] | string): ProgressStatus => {
  if (status === "completed") return "completed";
  if (status === "in-progress") return "in-progress";
  return "pending";
};

const progressStepIndex = (status: Task["status"] | string): number => {
  if (status === "completed") return 2;
  if (status === "in-progress") return 1;
  return 0;
};

const isBackwardProgressTransition = (
  currentStatus: Task["status"] | string,
  nextStatus: Task["status"] | string
): boolean => progressStepIndex(nextStatus) < progressStepIndex(currentStatus);

const buildAssignee = (profile: any): User | null => {
  if (!profile) return null;
  return {
    _id: profile.id,
    name: profile.full_name,
    email: profile.email,
    role: roleMap[(profile.role || "").toLowerCase()] || "Member",
    avatar: profile.avatar_url || undefined,
    team: profile.team || null,
    status: profile.is_active === false ? "away" : "active",
    lastActive: new Date().toISOString(),
    createdAt: profile.created_at || new Date().toISOString(),
  };
};

const buildStoreUser = (user: User | null): User | null => {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    team: user.team || null,
    status: user.status || "active",
    lastActive: user.lastActive || new Date().toISOString(),
    createdAt: user.createdAt || new Date().toISOString(),
  };
};

const parseDueDateLocal = (value?: string | null): Date | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const isPastDeadline = (dueDate?: string | null): boolean => {
  const parsed = parseDueDateLocal(dueDate);
  if (!parsed) return false;
  const deadlineEnd = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    23,
    59,
    59,
    999
  );
  return Date.now() > deadlineEnd.getTime();
};

const isIncompleteStatus = (status: Task["status"]): boolean => status !== "completed" && status !== "cancelled";

const needsOverdueWarning = (task: Task): boolean =>
  Boolean(task.assignedToId) &&
  !task.teamId &&
  Boolean(task.dueDate) &&
  isIncompleteStatus(task.status) &&
  isPastDeadline(task.dueDate);

const hasOverdueAlertMarker = (task: Task): boolean =>
  Array.isArray(task.activity) &&
  task.activity.some((entry: any) => entry?.action === OVERDUE_ALERT_ACTIVITY_ACTION);

const notifyLeadersAboutOverdueTasks = async (tasks: Task[], actor: User | null): Promise<void> => {
  const role = normalizeUserRole(actor?.role || "");
  if (role !== "CEO" && role !== "CTO") return;

  const overdueTasks = tasks.filter((task) => needsOverdueWarning(task) && !hasOverdueAlertMarker(task));
  if (overdueTasks.length === 0) return;

  const { data: leaders, error: leaderError } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["ceo", "cto"]);

  if (leaderError || !leaders?.length) return;

  const leaderIds = Array.from(new Set((leaders || []).map((leader: any) => leader.id).filter(Boolean)));
  if (leaderIds.length === 0) return;

  for (const task of overdueTasks) {
    const due = parseDueDateLocal(task.dueDate);
    const dueLabel = due
      ? due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "the set deadline";
    const assigneeName = task.assignedTo?.name || "Assigned member";
    const body = `${assigneeName} has not completed "${task.title}" before ${dueLabel}.`;

    const notificationRows = leaderIds.map((leaderId) => ({
      user_id: leaderId,
      type: "task_updated",
      title: OVERDUE_ALERT_TITLE,
      body,
      ref_id: task._id,
    }));

    await supabase.from("notifications").insert(notificationRows);
    await sendPushToUsers({
      userIds: leaderIds,
      title: OVERDUE_ALERT_TITLE,
      body,
      url: "/dashboard/pending",
      tag: `task-overdue-${task._id}`,
    });

    const nextActivity = [
      ...(task.activity || []),
      {
        user: buildStoreUser(actor),
        action: OVERDUE_ALERT_ACTIVITY_ACTION,
        details: `Overdue warning sent for ${assigneeName} (deadline ${dueLabel})`,
        timestamp: new Date().toISOString(),
      },
    ];

    const { error: markerError } = await supabase
      .from("tasks")
      .update({ activity: nextActivity })
      .eq("id", task._id);

    if (!markerError) {
      task.activity = nextActivity;
    }
  }
};

const generateClientId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createCommentEntry = (user: User | null, text: string, attachments: Attachment[] = []): Comment => ({
  _id: generateClientId(),
  user: buildStoreUser(user) as User,
  text,
  attachments,
  createdAt: new Date().toISOString(),
});

const normalizeSubtasks = (subtasks: Array<Partial<Subtask>> = []): Subtask[] =>
  subtasks
    .filter((subtask) => subtask?.title)
    .map((subtask) => ({
      _id: subtask._id || generateClientId(),
      title: subtask.title?.trim() || "Untitled subtask",
      completed: Boolean(subtask.completed),
      assignedTo: subtask.assignedTo,
    }));

const normalizeTeamProgress = (entries: any[] = []): TeamProgressEntry[] =>
  entries
    .filter((entry) => entry?.userId)
    .map((entry) => {
      const normalized = (entry.status || "").toLowerCase();
      return {
        userId: entry.userId,
        userName: entry.userName || "Member",
        status: normalized === "completed" ? "completed" : normalized === "in-progress" ? "in-progress" : "pending",
        updatedAt: entry.updatedAt || new Date().toISOString(),
      };
    });

const resolveTeamId = (team: User["team"]): string | null => {
  if (!team) return null;
  if (typeof team === "string") return team;
  if (typeof team === "object") {
    return team._id || team.id || null;
  }
  return null;
};

const buildTaskVisibilityFilter = (user: User | null): string | null => {
  if (!user?._id) return null;

  const role = normalizeUserRole(user.role);

  if (role === "CEO" || role === "CTO") {
    return null;
  }

  const filters = [
    `assigned_to.eq.${user._id}`,
    `created_by.eq.${user._id}`,
    "visibility.eq.all",
  ];

  if (role === "Member") {
    const teamId = resolveTeamId(user.team);
    if (teamId) {
      filters.push(`assigned_team.eq.${teamId}`);
    }
  } else {
    filters.push("visibility.eq.team");
  }

  return filters.join(",");
};

const resolveCurrentUser = async (): Promise<User | null> => {
  const existing = useAuthStore.getState().user;
  if (existing?._id) return existing;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, team, avatar_url, is_active, created_at")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) return null;
  return buildAssignee(profile);
};

const hydrateTasks = async (rows: any[]): Promise<Task[]> => {
  if (!rows?.length) return [];

  const assigneeIds = Array.from(new Set(rows.map((row) => row.assigned_to).filter(Boolean)));
  const creatorIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean)));
  const teamIds = Array.from(new Set(rows.map((row) => row.assigned_team).filter(Boolean)));

  const profileMap = new Map<string, any>();
  const profileIds = Array.from(new Set([...assigneeIds, ...creatorIds]));
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, team, avatar_url, is_active, created_at")
      .in("id", profileIds);
    (profiles || []).forEach((profile: any) => profileMap.set(profile.id, profile));
  }

  const teamMap = new Map<string, { _id: string; name: string }>();
  if (teamIds.length > 0) {
    const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
    (teams || []).forEach((team: any) => teamMap.set(team.id, { _id: team.id, name: team.name }));
  }

  return rows.map((row) => {
    const status = normalizeStatusFromDb(row.status);
    const priority = normalizePriorityFromDb(row.priority);
    const assignee = buildAssignee(profileMap.get(row.assigned_to));
    const creator = buildAssignee(profileMap.get(row.created_by));
    const teamRef = row.assigned_team ? teamMap.get(row.assigned_team) || { _id: row.assigned_team, name: "Team" } : null;
    const assignmentType: Task["assignmentType"] = row.assigned_to && row.assigned_team
      ? "hybrid"
      : row.assigned_team
        ? "team"
        : "individual";

    return {
      _id: row.id,
      title: row.title || "",
      description: row.description || "",
      status,
      priority,
      assignedTo: assignee,
      assignedToId: row.assigned_to || null,
      team: teamRef,
      teamId: row.assigned_team || null,
      assignmentType,
      createdBy: creator,
      dueDate: row.due_date || undefined,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
      comments: Array.isArray(row.comments) ? row.comments : [],
      activity: Array.isArray(row.activity) ? row.activity : [],
      teamProgress: normalizeTeamProgress(Array.isArray(row.team_progress) ? row.team_progress : []),
      tags: Array.isArray(row.tags) ? row.tags : [],
      isArchived: Boolean(row.is_archived),
      progress: typeof row.progress === "number" ? row.progress : progressFromStatus(status),
      completedAt: row.completed_at || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      visibility: row.visibility || "team",
    };
  });
};

const createAssignmentNotifications = async (task: Task) => {
  const rows: any[] = [];

  if (task.assignedToId) {
    rows.push({
      user_id: task.assignedToId,
      type: "task_assigned",
      title: "New personal task assigned",
      body: `${task.title} (${statusLabel(task.status)})`,
      ref_id: task._id,
    });
  }

  if (task.teamId) {
    const { data: members } = await supabase.from("profiles").select("id").eq("team", task.teamId);
    (members || []).forEach((member: any) => {
      if (member.id !== task.assignedToId) {
        rows.push({
          user_id: member.id,
          type: "task_assigned",
          title: "New team task assigned",
          body: `${task.title} was assigned to your team`,
          ref_id: task._id,
        });
      }
    });
  }

  if (rows.length > 0) {
    await supabase.from("notifications").insert(rows);
    await sendPushToUsers({
      userIds: rows.map((row) => row.user_id),
      title: task.teamId ? "New team task assigned" : "New task assigned",
      body: `${task.title} (${statusLabel(task.status)})`,
      url: `/dashboard/tasks/${task._id}`,
      tag: `task-assigned-${task._id}`,
    });
  }
};

const createTaskStatusNotifications = async (
  task: Task,
  status: Task["status"],
  meta?: { actorStatus?: Task["status"]; teamSummary?: { completed: number; total: number } }
) => {
  const actor = await resolveCurrentUser();
  const recipientIds = new Set<string>();

  if (task.teamId) {
    const { data: members } = await supabase.from("profiles").select("id").eq("team", task.teamId);
    (members || []).forEach((member: any) => recipientIds.add(member.id));
  }

  if (task.createdBy?._id) {
    recipientIds.add(task.createdBy._id);
  }

  if (task.assignedToId) {
    recipientIds.add(task.assignedToId);
  }

  if (actor?._id) {
    recipientIds.delete(actor._id);
  }

  if (recipientIds.size === 0) return;

  const baseStatus = statusLabel(status);
  const actorStatus = meta?.actorStatus ? statusLabel(meta.actorStatus) : baseStatus;
  const summary =
    meta?.teamSummary && meta.teamSummary.total > 0
      ? ` (${meta.teamSummary.completed}/${meta.teamSummary.total} completed)`
      : "";

  const body = meta?.actorStatus
    ? `${actor?.name || "A teammate"} updated "${task.title}" to ${actorStatus}${summary}`
    : `${actor?.name || "A teammate"} marked "${task.title}" as ${baseStatus}`;

  const rows = Array.from(recipientIds).map((userId) => ({
    user_id: userId,
    type: "task_updated",
    title: "Task status updated",
    body,
    ref_id: task._id,
  }));

  await supabase.from("notifications").insert(rows);
  await sendPushToUsers({
    userIds: rows.map((row) => row.user_id),
    title: "Task status updated",
    body,
    url: `/dashboard/tasks/${task._id}`,
    tag: `task-status-${task._id}`,
  });
};

const upsertTaskInState = (set: any, task: Task) => {
  set((state: TaskState) => ({
    tasks: state.tasks.some((existing) => existing._id === task._id)
      ? state.tasks.map((existing) => (existing._id === task._id ? task : existing))
      : [task, ...state.tasks],
    currentTask: state.currentTask?._id === task._id ? task : state.currentTask,
  }));
};

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  currentTask: null,
  isLoading: false,
  lastFetch: null,
  filters: {
    status: "all",
    priority: "all",
    search: "",
  },

  fetchTasks: async (force = false, silent = false, additionalFilters = {}) => {
    const { lastFetch } = get();
    if (!force && lastFetch && Date.now() - lastFetch < 10000) return;

    if (!silent) set({ isLoading: true });
    try {
      const me = await resolveCurrentUser();
      let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

      const visibilityFilter = buildTaskVisibilityFilter(me);
      if (visibilityFilter) {
        query = query.or(visibilityFilter);
      }

      if (additionalFilters.team) query = query.eq("assigned_team", additionalFilters.team);
      if (additionalFilters.status && additionalFilters.status !== "all") {
        query = query.eq("status", toDbStatus(additionalFilters.status));
      }
      if (additionalFilters.search) query = query.ilike("title", `%${additionalFilters.search}%`);

      const { data, error } = await query;
      if (error) throw error;

      const mappedTasks = await hydrateTasks(data || []);
      await notifyLeadersAboutOverdueTasks(mappedTasks, me);
      set({
        tasks: mappedTasks,
        isLoading: false,
        lastFetch: Date.now(),
      });
    } catch (err) {
      console.error(err);
      set({ isLoading: false });
    }
  },

  fetchTask: async (id) => {
    set({ isLoading: true, currentTask: null });
    try {
      const me = await resolveCurrentUser();
      const visibilityFilter = buildTaskVisibilityFilter(me);
      let query = supabase.from("tasks").select("*").eq("id", id);
      if (visibilityFilter) {
        query = query.or(visibilityFilter);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      const [task] = await hydrateTasks([data]);
      set({ currentTask: task || null, isLoading: false });
    } catch (err) {
      console.error(err);
      set({ currentTask: null, isLoading: false });
    }
  },

  createTask: async (data) => {
    const me = await resolveCurrentUser();
    const assignedToId = data.assignedTo || data.assigned_to || null;
    const assignedTeamId = data.team || data.assigned_team || null;

    if (!me?._id) {
      throw new Error("We could not verify the current account. Please refresh and try again.");
    }

    if (!assignedToId && !assignedTeamId) {
      throw new Error("Please assign this task to a member or a team.");
    }

    const memberVisibility = data.memberVisibility === "public" ? "all" : "personal";
    const visibility = assignedTeamId && !assignedToId ? "team" : memberVisibility;
    let initialTeamProgress: TeamProgressEntry[] = [];

    if (assignedTeamId && !assignedToId) {
      const { data: teamMembers, error: teamMembersError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("team", assignedTeamId);
      if (teamMembersError) throw teamMembersError;

      initialTeamProgress = (teamMembers || []).map((member: any) => ({
        userId: member.id,
        userName: member.full_name || member.email || "Member",
        status: "pending",
        updatedAt: new Date().toISOString(),
      }));
    }

    const payload = {
      title: data.title,
      description: data.description || null,
      status: "pending",
      priority: toDbPriority(data.priority || "medium"),
      due_date: data.dueDate || data.due_date || null,
      assigned_to: assignedToId,
      assigned_team: assignedTeamId,
      visibility,
      created_by: me._id,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      subtasks: normalizeSubtasks(Array.isArray(data.subtasks) ? data.subtasks : []),
      comments: [],
      activity: [
        {
          user: buildStoreUser(me),
          action: "created",
          details: "Task created",
          timestamp: new Date().toISOString(),
        },
      ],
      team_progress: initialTeamProgress,
      tags: Array.isArray(data.tags) ? data.tags : [],
      progress: 0,
      is_archived: false,
    };

    const { data: inserted, error } = await supabase.from("tasks").insert(payload).select("*").single();
    if (error) {
      if (error.message?.toLowerCase().includes("row-level security")) {
        throw new Error("Task creation is blocked by the database policy. Please apply the latest task workflow SQL patch and try again.");
      }
      throw error;
    }

    const [task] = await hydrateTasks([inserted]);
    if (!task) throw new Error("Task created but could not be mapped.");

    set((state) => ({ tasks: [task, ...state.tasks] }));
    await createAssignmentNotifications(task);
    return task;
  },

  updateTask: async (id, data) => {
    const updates: Record<string, any> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.priority !== undefined) updates.priority = toDbPriority(data.priority);
    if (data.status !== undefined) updates.status = toDbStatus(data.status);
    if ((data as any).dueDate !== undefined) updates.due_date = (data as any).dueDate || null;
    if ((data as any).assignedToId !== undefined) updates.assigned_to = (data as any).assignedToId || null;
    if ((data as any).teamId !== undefined) updates.assigned_team = (data as any).teamId || null;

    if (Object.keys(updates).length === 0) return;

    const { data: updated, error } = await supabase.from("tasks").update(updates).eq("id", id).select("*").single();
    if (error) throw error;

    const [task] = await hydrateTasks([updated]);
    if (!task) return;

    set((state) => ({
      tasks: state.tasks.map((existing) => (existing._id === id ? task : existing)),
      currentTask: state.currentTask?._id === id ? task : state.currentTask,
    }));
  },

  updateTaskStatus: async (id, status) => {
    const nextStatus = normalizeProgressStatus(status);
    if (status !== nextStatus) {
      throw new Error("Only Started, In Progress, and Completed status updates are allowed.");
    }

    const actor = await resolveCurrentUser();
    const previousTask =
      get().currentTask?._id === id
        ? get().currentTask
        : get().tasks.find((task) => task._id === id) || null;

    if (!previousTask) {
      await get().fetchTask(id);
    }

    const task =
      (get().currentTask?._id === id ? get().currentTask : get().tasks.find((item) => item._id === id)) || null;

    if (!task) {
      throw new Error("Task not found for status update.");
    }

    const isTeamTask = Boolean(task.teamId && !task.assignedToId);
    const actorRole = normalizeUserRole(actor?.role || "");
    const actorTeamId = resolveTeamId(actor?.team || null);

    // Team tasks keep per-member progress and auto-complete only when all members are done.
    if (isTeamTask && actorRole === "Member") {
      if (!actor?._id) {
        throw new Error("Unable to identify member for this progress update.");
      }
      if (!task.teamId || actorTeamId !== task.teamId) {
        throw new Error("You can only update tasks assigned to your own team.");
      }

      const { data: memberProfiles, error: memberError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("team", task.teamId);
      if (memberError) throw memberError;

      const progressMap = new Map<string, TeamProgressEntry>();
      normalizeTeamProgress(task.teamProgress || []).forEach((entry) => {
        progressMap.set(entry.userId, entry);
      });

      (memberProfiles || []).forEach((member: any) => {
        const existing = progressMap.get(member.id);
        progressMap.set(member.id, {
          userId: member.id,
          userName: member.full_name || member.email || "Member",
          status: existing?.status || "pending",
          updatedAt: existing?.updatedAt || new Date().toISOString(),
        });
      });

      const actorEntry = progressMap.get(actor._id) || {
        userId: actor._id,
        userName: actor.name || actor.email || "Member",
        status: "pending" as const,
        updatedAt: new Date().toISOString(),
      };

      const currentActorStatus = normalizeProgressStatus(actorEntry.status);
      if (isBackwardProgressTransition(currentActorStatus, nextStatus)) {
        throw new Error("Task progress cannot move backwards once updated.");
      }
      if (currentActorStatus === nextStatus) return;

      progressMap.set(actor._id, {
        ...actorEntry,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      const nextTeamProgress = Array.from(progressMap.values());
      const totalMembers = nextTeamProgress.length || 1;
      const completedCount = nextTeamProgress.filter((entry) => entry.status === "completed").length;
      const anyStarted = nextTeamProgress.some((entry) => entry.status === "pending" || entry.status === "in-progress" || entry.status === "completed");
      const anyInProgress = nextTeamProgress.some((entry) => entry.status === "in-progress");

      let globalStatus: Task["status"] = "pending";
      if (completedCount === totalMembers) {
        globalStatus = "completed";
      } else if (anyInProgress || (anyStarted && completedCount > 0)) {
        globalStatus = "in-progress";
      }

      const nextProgress = Math.round((completedCount / totalMembers) * 100);
      const nextActivity = [
        ...(task.activity || []),
        {
          user: buildStoreUser(actor),
          action: "team_progress_updated",
          details: `${actor?.name || "A teammate"} marked progress as ${statusLabel(nextStatus)} (${completedCount}/${totalMembers} completed)`,
          timestamp: new Date().toISOString(),
        },
      ];

      const { data: updated, error } = await supabase
        .from("tasks")
        .update({
          status: toDbStatus(globalStatus),
          progress: nextProgress,
          completed_at: globalStatus === "completed" ? new Date().toISOString() : null,
          team_progress: nextTeamProgress,
          activity: nextActivity,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      const [mappedTask] = await hydrateTasks([updated]);
      if (!mappedTask) throw new Error("Failed to refresh task status.");

      upsertTaskInState(set, mappedTask);
      await createTaskStatusNotifications(mappedTask, globalStatus, {
        actorStatus: nextStatus,
        teamSummary: { completed: completedCount, total: totalMembers },
      });
      return;
    }

    const currentStatus = normalizeProgressStatus(task.status);
    if (isBackwardProgressTransition(currentStatus, nextStatus)) {
      throw new Error("Task progress cannot move backwards once updated.");
    }
    if (currentStatus === nextStatus) return;

    set((state) => ({
      tasks: state.tasks.map((entry) =>
        entry._id === id
          ? {
              ...entry,
              status: nextStatus,
              progress: progressFromStatus(nextStatus),
              completedAt: nextStatus === "completed" ? new Date().toISOString() : undefined,
              updatedAt: new Date().toISOString(),
            }
          : entry
      ),
    }));

    try {
      const { data: updated, error } = await supabase
        .from("tasks")
        .update({
          status: toDbStatus(nextStatus),
          completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      const [mappedTask] = await hydrateTasks([updated]);
      if (mappedTask) {
        set((state) => ({
          tasks: state.tasks.map((existing) => (existing._id === id ? mappedTask : existing)),
          currentTask: state.currentTask?._id === id ? mappedTask : state.currentTask,
        }));

        if (normalizeProgressStatus(previousTask?.status || "pending") !== nextStatus) {
          await createTaskStatusNotifications(mappedTask, nextStatus);
        }
      }
    } catch (err) {
      if (previousTask) {
        set((state) => ({
          tasks: state.tasks.map((entry) => (entry._id === id ? previousTask : entry)),
          currentTask: state.currentTask?._id === id ? previousTask : state.currentTask,
        }));
      }
      throw err;
    }
  },

  addTaskComment: async (id, payload) => {
    const me = await resolveCurrentUser();
    const sourceTask =
      get().currentTask?._id === id
        ? get().currentTask
        : get().tasks.find((task) => task._id === id) || null;

    if (!sourceTask) {
      await get().fetchTask(id);
    }

    const task =
      (get().currentTask?._id === id ? get().currentTask : get().tasks.find((item) => item._id === id)) || null;

    if (!task || !me) {
      throw new Error("Task not available for commenting.");
    }

    const newComment = createCommentEntry(me, payload.text, payload.attachments || []);
    const nextComments = [...(task.comments || []), newComment];
    const nextActivity = [
      ...(task.activity || []),
      {
        user: buildStoreUser(me),
        action: "commented",
        details: payload.attachments?.length ? "Added a comment with attachments" : "Added a comment",
        timestamp: new Date().toISOString(),
      },
    ];

    const { data: updated, error } = await supabase
      .from("tasks")
      .update({
        comments: nextComments,
        activity: nextActivity,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    const [mappedTask] = await hydrateTasks([updated]);
    if (!mappedTask) throw new Error("Failed to refresh task comment state.");

    upsertTaskInState(set, mappedTask);
    return mappedTask;
  },

  toggleSubtask: async (id, subtaskId) => {
    const sourceTask =
      get().currentTask?._id === id
        ? get().currentTask
        : get().tasks.find((task) => task._id === id) || null;

    if (!sourceTask) {
      await get().fetchTask(id);
    }

    const me = await resolveCurrentUser();
    const task =
      (get().currentTask?._id === id ? get().currentTask : get().tasks.find((item) => item._id === id)) || null;

    if (!task || !me) {
      throw new Error("Task not available for subtask update.");
    }

    const nextSubtasks = (task.subtasks || []).map((subtask) =>
      subtask._id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
    );
    const completedCount = nextSubtasks.filter((subtask) => subtask.completed).length;
    const nextProgress = nextSubtasks.length ? Math.round((completedCount / nextSubtasks.length) * 100) : task.progress;

    const { data: updated, error } = await supabase
      .from("tasks")
      .update({
        subtasks: nextSubtasks,
        progress: nextProgress,
        activity: [
          ...(task.activity || []),
          {
            user: buildStoreUser(me),
            action: "subtask_updated",
            details: "Updated subtask progress",
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    const [mappedTask] = await hydrateTasks([updated]);
    if (!mappedTask) throw new Error("Failed to refresh task subtask state.");

    upsertTaskInState(set, mappedTask);
    return mappedTask;
  },

  deleteTask: async (id) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    set((state) => ({
      tasks: state.tasks.filter((task) => task._id !== id),
      currentTask: state.currentTask?._id === id ? null : state.currentTask,
    }));
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  getFilteredTasks: () => {
    const { tasks, filters } = get();
    return tasks.filter((task) => {
      const matchesStatus = filters.status === "all" || task.status === filters.status;
      const matchesPriority = filters.priority === "all" || task.priority === filters.priority;
      const matchesSearch =
        !filters.search ||
        task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        task.description.toLowerCase().includes(filters.search.toLowerCase());
      return matchesStatus && matchesPriority && matchesSearch;
    });
  },

  initRealtimeTasks: () => {
    if (taskRealtimeChannel) {
      supabase.removeChannel(taskRealtimeChannel);
    }

    taskRealtimeChannel = supabase
      .channel("public:tasks")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, () => {
        get().fetchTasks(true, true);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, () => {
        get().fetchTasks(true, true);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, () => {
        get().fetchTasks(true, true);
      });

    taskRealtimeChannel.subscribe();
  },
}));
