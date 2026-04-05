"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, CheckSquare, Calendar, Bell, BarChart3,
  Settings, LogOut, ChevronLeft, ChevronRight, Zap, ShieldCheck, Users, AlertTriangle
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { getDisplayName, getInitial } from "@/lib/utils";
import "./layout.css";

const coreNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/pending", label: "Pending", icon: AlertTriangle },
];

const collabNav = [
  { href: "/dashboard/meetings", label: "Meetings", icon: Calendar },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/teams", label: "Teams", icon: Users },
];

const adminNav = { href: "/dashboard/admin", label: "Admin Panel", icon: ShieldCheck };
const settingsNav = { href: "/dashboard/settings", label: "Settings", icon: Settings };

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, setSidebar } = useUIStore();
  const [isCompact, setIsCompact] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const displayName = getDisplayName(user?.name, user?.email);
  const userInitial = getInitial(user?.name, user?.email);

  useEffect(() => {
    const syncSidebarForViewport = () => {
      const mobile = window.innerWidth <= 1024;
      const compact = window.innerWidth <= 1100;
      setIsMobile(mobile);
      setIsCompact(compact);
      if (compact) setSidebar(false);
    };

    syncSidebarForViewport();
    window.addEventListener("resize", syncSidebarForViewport);
    return () => window.removeEventListener("resize", syncSidebarForViewport);
  }, [setSidebar]);

  const canManageAdmin = user && (user.role?.toLowerCase() === "ceo" || user.role?.toLowerCase() === "cto" || user.role?.toLowerCase() === "admin");
  const navGroups = [
    { label: "Core", items: coreNav },
    { label: "Collaborate", items: collabNav },
    {
      label: "Management",
      items: [...(canManageAdmin ? [adminNav] : []), settingsNav],
    },
  ];

  if (isMobile) {
    return null;
  }

  return (
    <motion.aside
      animate={{ width: sidebarOpen && !isCompact ? 248 : 72 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="sidebar-container"
    >
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">
          <Zap size={20} />
        </div>
        <AnimatePresence>
          {sidebarOpen && !isCompact && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}>Taskpholio</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Team Management</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.label} className="sidebar-nav-group">
            {sidebarOpen && !isCompact && <p className="sidebar-section-label">{group.label}</p>}
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link key={href} href={href}>
                  <motion.div whileHover={{ x: 2 }} className={`sidebar-nav-item ${active ? 'active' : ''}`}>
                    <Icon />
                    <AnimatePresence>
                      {sidebarOpen && !isCompact && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {user && (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {userInitial}
            </div>
            <AnimatePresence>
              {sidebarOpen && !isCompact && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1" style={{ minWidth: 0 }}>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</p>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user.role || 'User'}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <button onClick={logout} className="btn-icon" title="Logout" style={{ flexShrink: 0, marginLeft: 'auto', padding: '0.25rem' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}

      {!isCompact && (
        <button onClick={toggleSidebar} className="sidebar-toggle-btn">
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      )}
    </motion.aside>
  );
}
