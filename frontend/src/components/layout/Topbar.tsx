"use client";
import React, { useState } from "react";
import { Moon, Sun, Search } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import NotificationCenter from "../notifications/NotificationCenter";
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt";
import { getDisplayName, getInitial } from "@/lib/utils";
import "./layout.css";

interface Props {
  title: string;
}

export default function Topbar({ title }: Props) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();
  const [failedAvatarUrls, setFailedAvatarUrls] = useState<Record<string, true>>({});

  const displayName = getDisplayName(user?.name, user?.email);
  const avatarUrl = user?.avatar && !failedAvatarUrls[user.avatar] ? user.avatar : null;

  return (
    <header className="topbar-container">
      <h1 className="topbar-title topbar-title-hidden">{title}</h1>

      <div className="topbar-actions">
        <div className="topbar-search">
          <Search size={14} className="topbar-search-icon" />
          <input type="text" placeholder="Search tasks, members..." aria-label="Search dashboard" />
          <span className="topbar-search-kbd">⌘K</span>
        </div>

        <PWAInstallPrompt />

        <button onClick={toggleTheme} className="btn-icon">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

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
