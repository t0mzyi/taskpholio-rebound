import { supabase } from "@/lib/supabase";

interface PushPayload {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUsers(payload: PushPayload): Promise<void> {
  const userIds = Array.from(new Set((payload.userIds || []).filter(Boolean)));
  if (userIds.length === 0) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      console.error("Push invoke skipped: no active session token.");
      return;
    }

    const { data, error } = await supabase.functions.invoke("send-push", {
      body: {
        userIds,
        title: payload.title,
        body: payload.body,
        url: payload.url || "/dashboard/notifications",
        tag: payload.tag || "taskpholio-update",
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      console.error("Push invoke failed:", error.message || error);
      return;
    }

    if (data?.success === false) {
      console.error("Push function rejected request:", data?.error || "Unknown send-push error");
    }
  } catch (error) {
    console.error("Push invoke crashed:", error);
  }
}
