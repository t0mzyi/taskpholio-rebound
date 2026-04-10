"use client";
import React, { useState } from "react";
import { Search } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationCenter from "../notifications/NotificationCenter";
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt";
import { getDisplayName, getInitial } from "@/lib/utils";
import "./layout.css";

interface Props {
  title: string;
}

export default function Topbar({ title }: Props) {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [failedAvatarUrls, setFailedAvatarUrls] = useState<Record<string, true>>({});

  const searchPlaceholderMap: Record<string, string> = {
    "/dashboard": "Search tasks, teams...",
    "/dashboard/tasks": "Search tasks...",
    "/dashboard/teams": "Search teams...",
    "/dashboard/notifications": "Search notifications...",
    "/dashboard/meetings": "Search schedules...",
    "/dashboard/analytics": "Search analytics...",
    "/dashboard/pending": "Search pending tasks...",
    "/dashboard/settings": "Search settings...",
    "/dashboard/admin": "Search users...",
    "/dashboard/profile": "Search profile...",
  };

  const displayName = getDisplayName(user?.name, user?.email);
  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const avatarUrl = user?.avatar && !failedAvatarUrls[user.avatar] ? user.avatar : null;
  const searchPlaceholder = searchPlaceholderMap[pathname] || "Search tasks, members...";

  return (
    <header className="topbar-container">
      <h1 className="topbar-title topbar-title-hidden">{title}</h1>

      <div className="topbar-actions">
        <div className="topbar-search">
          <Search size={14} className="topbar-search-icon" />
          <input type="text" placeholder={searchPlaceholder} aria-label="Search dashboard" />
          <span className="topbar-search-kbd">⌘K</span>
        </div>

        <div className="topbar-chips" aria-label="Context filters">
          <span className="topbar-chip">{monthLabel}</span>
          <span className="topbar-chip topbar-chip-active">Today</span>
        </div>

        <PWAInstallPrompt />

        <NotificationCenter />

        {user && (
          <Link href="/dashboard/settings" className="topbar-avatar-link">
            <div className="topbar-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  onError={() => setFailedAvatarUrls((prev) => ({ ...prev, [avatarUrl]: true }))}
                />
              ) : (
                getInitial(user.name, user.email)
              )}
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
