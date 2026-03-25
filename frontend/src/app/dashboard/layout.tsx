"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTaskStore } from "@/store/taskStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useUIStore } from "@/store/uiStore";
import { registerPushSubscription } from "@/lib/pushSubscription";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { usePathname } from "next/navigation";
import "@/components/layout/layout.css";
import "@/app/dashboard/screens.css";

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/tasks": "Tasks",
  "/dashboard/timeline": "Timeline",
  "/dashboard/teams": "Teams",
  "/dashboard/meetings": "Meetings",
  "/dashboard/notifications": "Notifications",
  "/dashboard/analytics": "Advanced Analytics",
  "/dashboard/pending": "Pending Tasks",
  "/dashboard/profile": "Profile Settings",
  "/dashboard/settings": "Settings",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchMe, token } = useAuthStore();
  const { initTheme } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();
  const { fetchTasks } = useTaskStore();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    setIsMounted(true);
    const localToken = localStorage.getItem("taskpholio_token") || sessionStorage.getItem("taskpholio_token");
    
    if (!localToken) {
      router.replace("/login");
      return;
    }
    
    // Fetch fresh user data on mount
    fetchMe();
  }, [fetchMe, router]);

  const { initRealtimeTasks } = useTaskStore();
  const { initRealtime } = useNotificationStore();

  useEffect(() => {
    if (isMounted && !isAuthenticated && !token) {
      router.replace("/login");
    }
  }, [isMounted, isAuthenticated, token, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const attemptRegistration = () => {
      if (document.visibilityState === "hidden") return;
      registerPushSubscription().catch((error) => {
        console.error("Push registration failed:", error);
      });
    };

    attemptRegistration();
    window.addEventListener("focus", attemptRegistration);
    document.addEventListener("visibilitychange", attemptRegistration);

    return () => {
      window.removeEventListener("focus", attemptRegistration);
      document.removeEventListener("visibilitychange", attemptRegistration);
    };
  }, [isAuthenticated]);

  // Supabase Realtime Subscriptions
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Initialize real-time listeners for updates
    initRealtimeTasks();
    
    // Initialize notification real-time listener if we have the user
    const subUser = useAuthStore.getState().user;
    if (subUser?._id) {
      initRealtime(subUser._id);
    }
    
    // Cleanup subscriptions automatically handled or we can just leave them
  }, [isAuthenticated, initRealtimeTasks, initRealtime]);

  if (!isMounted) return null; // Prevent hydration flash

  const title = pageTitles[pathname] || "Dashboard";

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <Topbar title={title} />
        <main className="dashboard-content">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
