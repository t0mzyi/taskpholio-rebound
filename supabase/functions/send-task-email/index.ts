import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TaskEmailRequest = {
  userIds?: string[];
  taskId?: string;
  taskTitle?: string;
  taskDescription?: string;
  dueDate?: string;
  assignerName?: string;
  teamName?: string;
  isTeamTask?: boolean;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDueDate = (rawDueDate?: string): string => {
  if (!rawDueDate) return "No deadline set";
  const parsed = new Date(rawDueDate);
  if (Number.isNaN(parsed.getTime())) return rawDueDate;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const renderTaskEmail = (options: {
  receiverName: string;
  taskTitle: string;
  taskDescription: string;
  dueDate: string;
  assignerName: string;
  taskUrl: string;
  isTeamTask: boolean;
  teamName: string;
}) => {
  const assignmentLabel = options.isTeamTask
    ? `assigned to your team${options.teamName ? ` (${escapeHtml(options.teamName)})` : ""}`
    : "assigned directly to you";

  return `
    <div style="font-family:Arial,sans-serif;background:#070912;color:#f5f7ff;padding:24px;">
      <div style="max-width:640px;margin:0 auto;border:1px solid rgba(255,255,255,0.15);border-radius:16px;background:#11162a;padding:24px;">
        <h2 style="margin:0 0 12px;font-size:22px;color:#8b95ff;">Taskpholio</h2>
        <p style="margin:0 0 14px;font-size:14px;opacity:0.88;">Hi ${escapeHtml(options.receiverName)},</p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;">
          A new task has been ${assignmentLabel} by <strong>${escapeHtml(options.assignerName)}</strong>.
        </p>
        <div style="border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:14px;background:#0c1020;">
          <p style="margin:0 0 8px;font-size:13px;opacity:0.78;">Task</p>
          <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#e7ebff;">${escapeHtml(options.taskTitle)}</p>
          <p style="margin:0 0 8px;font-size:13px;opacity:0.78;">Description</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#d4d9ff;">${escapeHtml(options.taskDescription || "No description provided.")}</p>
          <p style="margin:0;font-size:13px;"><strong>Deadline:</strong> ${escapeHtml(options.dueDate)}</p>
        </div>
        <a href="${options.taskUrl}" style="display:inline-block;margin-top:18px;padding:11px 16px;border-radius:10px;background:#5965ff;color:white;text-decoration:none;font-weight:700;">
          Open Task
        </a>
      </div>
    </div>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const emailFrom = Deno.env.get("EMAIL_FROM") ?? "";
    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://admin.labsrebound.com";

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase environment variables." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing Authorization header." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Authentication failed." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as TaskEmailRequest;
    const userIds = Array.from(new Set((payload.userIds || []).filter(Boolean)));
    if (!userIds.length || !payload.taskTitle) {
      return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, skipped: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey || !emailFrom) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          failed: 0,
          skipped: userIds.length,
          reason: "Missing RESEND_API_KEY or EMAIL_FROM",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: recipients, error: recipientError } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (recipientError) {
      return new Response(JSON.stringify({ success: false, error: recipientError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRecipients = (recipients || []).filter((entry: any) => Boolean(entry?.email));
    if (!validRecipients.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, skipped: userIds.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taskTitle = payload.taskTitle || "Task";
    const taskDescription = payload.taskDescription || "";
    const assignerName = payload.assignerName || "Leadership";
    const teamName = payload.teamName || "";
    const dueDate = formatDueDate(payload.dueDate);
    const taskUrl = payload.taskId
      ? `${appBaseUrl.replace(/\/+$/, "")}/dashboard/tasks/${payload.taskId}`
      : `${appBaseUrl.replace(/\/+$/, "")}/dashboard/tasks`;
    const isTeamTask = Boolean(payload.isTeamTask);

    const subject = isTeamTask
      ? `New team task assigned: ${taskTitle}`
      : `New task assigned: ${taskTitle}`;

    let sent = 0;
    let failed = 0;

    for (const recipient of validRecipients) {
      try {
        const html = renderTaskEmail({
          receiverName: recipient.full_name || recipient.email || "Member",
          taskTitle,
          taskDescription,
          dueDate,
          assignerName,
          taskUrl,
          isTeamTask,
          teamName,
        });

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [recipient.email],
            subject,
            html,
          }),
        });

        if (!resendResponse.ok) {
          failed += 1;
          continue;
        }
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    const skipped = Math.max(0, userIds.length - validRecipients.length);

    return new Response(JSON.stringify({ success: true, sent, failed, skipped }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unexpected error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
