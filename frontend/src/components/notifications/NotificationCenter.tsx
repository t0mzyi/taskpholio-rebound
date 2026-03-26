"use client";
import { useState, useEffect } from "react";
import { 
  Bell, Check, Trash2, X, AlertCircle, 
  Play, ShieldCheck, CheckCircle2, MessageSquare,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationStore } from "@/store/notificationStore";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { registerPushSubscription } from "@/lib/pushSubscription";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [requestingPermission, setRequestingPermission] = useState(false);
  const { 
    notifications, unreadCount, fetchNotifications, 
    markAsRead, markAllAsRead, clearAllNotifications, deleteNotification 
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setIsMobile(window.innerWidth <= 1024);
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      }
    };

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isMobile]);

  const getIcon = (type: string) => {
    const kind = (type || "").toUpperCase();
    switch (kind) {
      case 'TASK_ASSIGNED': return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'TASK_UPDATED': return <Play className="w-4 h-4 text-amber-400" />;
      case 'TASK_COMPLETED': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'TASK_COMMENT': return <MessageSquare className="w-4 h-4 text-primary" />;
      case 'MEMBER_ADDED': return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'MEETING_READY': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'MEETING_SCHEDULED': return <Calendar className="w-4 h-4 text-purple-400" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const resolveNotificationHref = (notif: any): string => {
    const type = String(notif?.type || "").toUpperCase();
    const refId = notif?.link;

    if (type.includes("MEETING")) {
      return "/dashboard/meetings";
    }
    if (refId) {
      return `/dashboard/tasks/${refId}`;
    }
    return "/dashboard/notifications";
  };

  const handleEnableAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (notificationPermission === "denied") return;

    setRequestingPermission(true);
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        await registerPushSubscription();
      }
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    try {
      await clearAllNotifications();
      toast.success("All notifications cleared.");
    } catch {
      toast.error("Unable to clear notifications.");
    }
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="topbar-bell-btn"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="topbar-bell-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "notification-center-panel rounded-3xl z-50 overflow-hidden flex flex-col",
                isMobile ? "fixed" : "absolute right-0 mt-3 w-96"
              )}
              style={
                isMobile
                  ? {
                      left: "0",
                      right: "0",
                      width: "min(92vw, 420px)",
                      marginLeft: "auto",
                      marginRight: "auto",
                      top: "calc(env(safe-area-inset-top) + 4.5rem)",
                      maxHeight: "min(68vh, 560px)",
                    }
                  : undefined
              }
            >
              {/* Header */}
              <div className="notification-center-header p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-black text-foreground tracking-tight">Intelligence Feed</h3>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Real-time Briefing Updates</p>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="notification-center-actions">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="notification-center-action-btn"
                    >
                      Acknowledge All Updates
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="notification-center-action-btn danger"
                    >
                      Clear All
                    </button>
                  )}
                  {notificationPermission !== "granted" && (
                    <button
                      onClick={handleEnableAlerts}
                      disabled={requestingPermission || notificationPermission === "denied"}
                      className="notification-center-action-btn neutral disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {notificationPermission === "denied"
                        ? "Alerts Blocked"
                        : requestingPermission
                          ? "Enabling..."
                          : "Enable Alerts"}
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="notification-center-list max-h-[500px] overflow-y-auto custom-scrollbar flex-1" style={{ minHeight: 0 }}>
                {notifications.length === 0 ? (
                  <div className="notification-center-empty py-20 flex flex-col items-center justify-center text-center px-10">
                    <div className="w-16 h-16 rounded-3xl notification-center-empty-icon flex items-center justify-center mb-6">
                        <Bell className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <h4 className="font-black text-sm text-foreground mb-2">Comms Line Clear</h4>
                    <p className="text-xs text-muted-foreground font-medium">No tactical updates or mission alerts at this time.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((notif: any) => (
                      <div
                        key={notif._id}
                        className={cn(
                          "notification-center-item w-full text-left p-5 transition-all group relative cursor-pointer",
                          !notif.read && "notification-center-item-unread shadow-inner shadow-primary/5"
                        )}
                        onClick={() => {
                          const href = resolveNotificationHref(notif);
                          setIsOpen(false);
                          if (!notif.read) markAsRead(notif._id);
                          router.push(href);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            const href = resolveNotificationHref(notif);
                            setIsOpen(false);
                            if (!notif.read) markAsRead(notif._id);
                            router.push(href);
                          }
                        }}
                      >
                        <div className="flex gap-4">
                          <div className={cn(
                            "notification-center-icon-shell w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                            !notif.read ? "bg-primary/20 border border-primary/20" : "bg-white/5 border border-white/10"
                          )}>
                            {getIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h5 className="text-sm font-black text-foreground line-clamp-1">{notif.title}</h5>
                              {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />}
                            </div>
                            <p className="text-xs text-muted-foreground font-medium leading-relaxed mb-3 line-clamp-2">
                              {notif.message}
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                  {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!notif.read && (
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); markAsRead(notif._id); }}
                                            className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-all"
                                            title="Acknowledge"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}
                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500 transition-all"
                                        title="Purge"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="notification-center-footer p-4 text-center">
                  <button className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] hover:text-foreground transition-all">
                      Access Strategic Archive
                  </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
