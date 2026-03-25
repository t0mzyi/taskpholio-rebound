"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Download, Loader2, Share, X } from "lucide-react";
import { registerPushSubscription } from "@/lib/pushSubscription";
import { toast } from "sonner";

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

const isIOS = () => {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
};

const isSafari = () => {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome") && !ua.includes("crios") && !ua.includes("android");
};

const isAndroid = () => {
  if (typeof window === "undefined") return false;
  return /android/i.test(window.navigator.userAgent);
};

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPromptEvent | null>(null);
  const [showIOSInstallHelp, setShowIOSInstallHelp] = useState(false);
  const [showAndroidInstallHelp, setShowAndroidInstallHelp] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [requestingNotification, setRequestingNotification] = useState(false);
  const [installing, setInstalling] = useState(false);
  const appInstalledRef = useRef(false);
  const installFollowupTimeoutRef = useRef<number | null>(null);

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
      appInstalledRef.current = true;
      setDeferredPrompt(null);
      setShowIOSInstallHelp(false);
      setShowAndroidInstallHelp(false);
      setNotificationPermission(
        typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
      );
      toast.success("Taskpholio installed successfully.");
      await registerPushSubscription().catch(() => undefined);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      if (installFollowupTimeoutRef.current) {
        window.clearTimeout(installFollowupTimeoutRef.current);
      }
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const standalone = isStandaloneMode();
    if (standalone) {
      toast.info("Taskpholio is already installed.");
      return;
    }

    if (!deferredPrompt) {
      if (isIOS()) {
        setShowIOSInstallHelp(true);
        return;
      }
      if (isAndroid()) {
        setShowAndroidInstallHelp(true);
        return;
      }
      toast.warning("Install prompt is not available in this browser yet.");
      return;
    }

    setInstalling(true);
    try {
      appInstalledRef.current = false;
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("Install accepted. Check your home screen.");
        if (installFollowupTimeoutRef.current) {
          window.clearTimeout(installFollowupTimeoutRef.current);
        }
        installFollowupTimeoutRef.current = window.setTimeout(() => {
          if (!appInstalledRef.current && !isStandaloneMode() && isAndroid()) {
            setShowAndroidInstallHelp(true);
          }
        }, 2200);
      } else {
        toast.info("Install dismissed.");
      }
      setDeferredPrompt(null);
    } catch {
      toast.error("Install failed. Please try from browser menu.");
    } finally {
      setInstalling(false);
    }
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

  const showInstall = !isStandaloneMode() && (Boolean(deferredPrompt) || isIOS() || isAndroid());
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
        <button
          type="button"
          className="topbar-install-btn"
          onClick={handleInstall}
          title="Install Taskpholio App"
          disabled={installing}
        >
          {installing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          <span>{installing ? "Installing..." : "Install"}</span>
        </button>
      )}

      {showIOSInstallHelp && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="glass rounded-2xl border border-white/10 w-full max-w-sm p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">Install on iPhone</h3>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
                onClick={() => setShowIOSInstallHelp(false)}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Use Safari to install. Tap <span className="text-foreground font-semibold inline-flex items-center gap-1"><Share size={14} /> Share</span>, then choose <span className="text-foreground font-semibold">Add to Home Screen</span>.
            </p>
            {!isSafari() && (
              <p className="text-xs text-amber-300 mt-3">
                You are not on Safari. iPhone install works best in Safari.
              </p>
            )}
          </div>
        </div>
      )}

      {showAndroidInstallHelp && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="glass rounded-2xl border border-white/10 w-full max-w-sm p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">Install on Android</h3>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
                onClick={() => setShowAndroidInstallHelp(false)}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Open browser menu (3 dots), then tap <span className="text-foreground font-semibold">Install app</span> or{" "}
              <span className="text-foreground font-semibold">Add to Home screen</span>.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
