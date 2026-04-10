import { supabase } from "@/lib/supabase";

interface TaskAssignmentEmailPayload {
  userIds: string[];
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  assignerName?: string;
  teamName?: string;
  isTeamTask?: boolean;
}

interface MeetingScheduledEmailPayload {
  userIds: string[];
  meetingId: string;
  meetingTitle: string;
  meetingDescription?: string;
  scheduledAt?: string;
  meetingLink?: string;
  organizerName?: string;
  location?: string;
}

interface PendingTaskReminderEmailPayload {
  userIds: string[];
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  assignerName?: string;
  teamName?: string;
  reminderAgeDays?: number;
}

const getFreshAccessToken = async (): Promise<string | null> => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) return null;

  const expiresSoon =
    typeof session.expires_at === "number" &&
    session.expires_at * 1000 <= Date.now() + 30_000;

  if (!expiresSoon) return session.access_token;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (!refreshError && refreshed?.session?.access_token) {
    return refreshed.session.access_token;
  }

  return session.access_token;
};

const invokeEmailFunction = async (
  functionName: string,
  body: Record<string, unknown>,
  label: string
): Promise<void> => {
  let accessToken = await getFreshAccessToken();
  if (!accessToken) {
    console.error(`${label} invoke skipped: no active session token.`);
    return;
  }

  const invoke = async (token: string) =>
    supabase.functions.invoke(functionName, {
      body,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

  let { data, error } = await invoke(accessToken);
  const errorMessage = String((error as any)?.message || "").toLowerCase();

  if (error && (errorMessage.includes("401") || errorMessage.includes("unauthorized") || errorMessage.includes("jwt"))) {
    const refreshedToken = await getFreshAccessToken();
    if (refreshedToken) {
      accessToken = refreshedToken;
      const retry = await invoke(accessToken);
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) {
    console.error(`${label} invoke failed:`, error.message || error);
    return;
  }

  if (data?.success === false) {
    console.error(`${label} function rejected request:`, data?.error || data?.reason || `Unknown ${functionName} error`);
    return;
  }

  if (Array.isArray(data?.failedReasons) && data.failedReasons.length > 0) {
    console.error(`${label} delivery failures:`, data.failedReasons);
  }
};

export async function sendTaskAssignmentEmails(payload: TaskAssignmentEmailPayload): Promise<void> {
  const userIds = Array.from(new Set((payload.userIds || []).filter(Boolean)));
  if (!userIds.length) return;

  try {
    await invokeEmailFunction(
      "send-task-email",
      {
        userIds,
        taskId: payload.taskId,
        taskTitle: payload.taskTitle,
        taskDescription: payload.taskDescription || "",
        dueDate: payload.dueDate || "",
        assignerName: payload.assignerName || "Leadership",
        teamName: payload.teamName || "",
        isTeamTask: Boolean(payload.isTeamTask),
      },
      "Task email"
    );
  } catch (error) {
    console.error("Email invoke crashed:", error);
  }
}

export async function sendMeetingScheduledEmails(payload: MeetingScheduledEmailPayload): Promise<void> {
  const userIds = Array.from(new Set((payload.userIds || []).filter(Boolean)));
  if (!userIds.length) return;

  try {
    await invokeEmailFunction(
      "send-meeting-email",
      {
        userIds,
        meetingId: payload.meetingId,
        meetingTitle: payload.meetingTitle,
        meetingDescription: payload.meetingDescription || "",
        scheduledAt: payload.scheduledAt || "",
        meetingLink: payload.meetingLink || "",
        organizerName: payload.organizerName || "Leadership",
        location: payload.location || "Virtual HQ",
      },
      "Meeting email"
    );
  } catch (error) {
    console.error("Meeting email invoke crashed:", error);
  }
}

export async function sendPendingTaskReminderEmails(payload: PendingTaskReminderEmailPayload): Promise<void> {
  const userIds = Array.from(new Set((payload.userIds || []).filter(Boolean)));
  if (!userIds.length) return;

  try {
    await invokeEmailFunction(
      "send-task-email",
      {
        userIds,
        taskId: payload.taskId,
        taskTitle: payload.taskTitle,
        taskDescription: payload.taskDescription || "",
        dueDate: payload.dueDate || "",
        assignerName: payload.assignerName || "Leadership",
        teamName: payload.teamName || "",
        isTeamTask: Boolean(payload.teamName),
        emailType: "pending_reminder",
        reminderAgeDays: payload.reminderAgeDays || 0,
      },
      "Pending reminder email"
    );
  } catch (error) {
    console.error("Pending reminder email invoke crashed:", error);
  }
}
