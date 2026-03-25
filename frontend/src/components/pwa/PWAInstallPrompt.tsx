"use client";

import { useEffect, useState } from "react";
import { Bell, Download, Loader2 } from "lucide-react";
import { registerPushSubscription } from "@/lib/pushSubscription";

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type IOSNavigator = Navigator & { standalone?: boolean };

const isStandaloneMode = () => {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as IOSNavigator;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
};

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPromptEvent | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [requestingNotification, setRequestingNotification] = useState(false);

  useEffect(() => {
    const installed = isStandaloneMode();
    const permission =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default";
    setNotificationPermission(permission);
    if (installed) {
      setDeferredPrompt(null);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPromptEvent);
    };

    const onInstalled = async () => {
      setDeferredPrompt(null);
      setNotificationPermission(
        typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
      );
      await registerPushSubscription().catch(() => undefined);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleEnableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (notificationPermission === "denied") return;

    setRequestingNotification(true);
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        await registerPushSubscription();
      }
    } finally {
      setRequestingNotification(false);
    }
  };

  const showInstall = !isStandaloneMode() && Boolean(deferredPrompt);
  const showNotificationEnable = notificationPermission !== "granted";

  if (!showInstall && !showNotificationEnable) return null;

  return (
    <>
      {showNotificationEnable && (
        <button
          type="button"
          className="topbar-install-btn"
          onClick={handleEnableNotifications}
          title="Enable task notifications"
          disabled={notificationPermission === "denied" || requestingNotification}
          style={notificationPermission === "denied" ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
        >
          {requestingNotification ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
          <span>{notificationPermission === "denied" ? "Alerts Blocked" : "Enable Alerts"}</span>
        </button>
      )}

      {showInstall && (
        <button type="button" className="topbar-install-btn" onClick={handleInstall} title="Install Taskpholio App">
          <Download size={14} />
          <span>Install</span>
        </button>
      )}
    </>
  );
}
