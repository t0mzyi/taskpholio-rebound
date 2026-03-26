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

export async function sendTaskAssignmentEmails(payload: TaskAssignmentEmailPayload): Promise<void> {
  const userIds = Array.from(new Set((payload.userIds || []).filter(Boolean)));
  if (!userIds.length) return;

  try {
    let accessToken = await getFreshAccessToken();
    if (!accessToken) {
      console.error("Email invoke skipped: no active session token.");
      return;
    }

    const invoke = async (token: string) =>
      supabase.functions.invoke("send-task-email", {
        body: {
          userIds,
          taskId: payload.taskId,
          taskTitle: payload.taskTitle,
          taskDescription: payload.taskDescription || "",
          dueDate: payload.dueDate || "",
          assignerName: payload.assignerName || "Leadership",
          teamName: payload.teamName || "",
          isTeamTask: Boolean(payload.isTeamTask),
        },
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
      console.error("Email invoke failed:", error.message || error);
      return;
    }

    if (data?.success === false) {
      console.error("Email function rejected request:", data?.error || "Unknown send-task-email error");
    }
  } catch (error) {
    console.error("Email invoke crashed:", error);
  }
}
