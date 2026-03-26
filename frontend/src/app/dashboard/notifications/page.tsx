"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Clock, Rocket, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";

type RowNotification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<RowNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const fetchNotifications = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        setNotifications([]);
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      setNotifications(
        (data || []).map((row: any) => ({
          _id: row.id,
          type: row.type,
          title: row.title,
          message: row.body,
          read: row.read,
          createdAt: row.created_at,
        }))
      );
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    const subscribe = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!mounted || !userId) return;

      channel = supabase
        .channel(`notifications-page-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => fetchNotifications()
        )
        .subscribe();
    };

    subscribe();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markAllRead = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;
      await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
      setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
    } catch {
      toast.error("Unable to mark notifications as read");
    }
  };

  const clearAll = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;
      const { error } = await supabase.from("notifications").delete().eq("user_id", userId);
      if (error) throw error;
      setNotifications([]);
      toast.success("Notifications cleared");
    } catch {
      toast.error("Unable to clear notifications");
    }
  };

  const getIcon = (type: string) => {
    const kind = (type || "").toUpperCase();
    if (kind.includes("MEETING")) return <Clock size={14} style={{ color: "#34d399" }} />;
    if (kind.includes("TASK_ASSIGNED")) return <Rocket size={14} style={{ color: "#8b95ff" }} />;
    if (kind.includes("TASK_UPDATED")) return <ShieldAlert size={14} style={{ color: "#fbbf24" }} />;
    return <Bell size={14} style={{ color: "#8b95ff" }} />;
  };

  return (
    <div className="saas-page" style={{ maxWidth: "1100px" }}>
      <header className="saas-header">
        <div>
          <p className="saas-heading-eyebrow">Real-Time Updates</p>
          <h1 className="saas-heading-title">Notifications</h1>
          <p className="saas-heading-subtitle">{unreadCount} unread notifications</p>
        </div>

        <div className="saas-notification-actions">
          <button type="button" className="saas-btn-secondary" onClick={markAllRead}>
            <CheckCheck size={14} /> Mark all read
          </button>
          <button type="button" className="saas-btn-secondary" onClick={clearAll}>
            <Trash2 size={14} /> Clear all
          </button>
        </div>
      </header>

      <section>
        {loading ? (
          <div className="saas-empty">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="saas-empty">No notifications yet.</div>
        ) : (
          notifications.map((notification) => (
            <article key={notification._id} className="saas-glass saas-notification-item">
              <div className="saas-notification-left">
                <div className="saas-notification-icon">{getIcon(notification.type)}</div>
                <div style={{ minWidth: 0 }}>
                  <p className="saas-notification-title" style={{ opacity: notification.read ? 0.7 : 1 }}>
                    {notification.title}
                  </p>
                  <p className="saas-notification-message">{notification.message}</p>
                </div>
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="saas-notification-time">{formatRelativeTime(notification.createdAt)}</span>
                {!notification.read && (
                  <span
                    style={{
                      width: "0.34rem",
                      height: "0.34rem",
                      borderRadius: "999px",
                      background: "#8b95ff",
                    }}
                  />
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
