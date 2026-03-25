"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, Layers, MoreHorizontal, SquareCheckBig } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/dashboard/tasks", label: "Tasks", icon: SquareCheckBig },
  { href: "/dashboard/teams", label: "Teams", icon: Layers },
  { href: "/dashboard/notifications", label: "Alerts", icon: Bell },
  { href: "/dashboard/settings", label: "More", icon: MoreHorizontal },
];

const isItemActive = (pathname: string, href: string): boolean => {
  if (href === "/dashboard/settings") {
    return (
      pathname.startsWith("/dashboard/settings") ||
      pathname.startsWith("/dashboard/profile") ||
      pathname.startsWith("/dashboard/admin") ||
      pathname.startsWith("/dashboard/analytics") ||
      pathname.startsWith("/dashboard/meetings") ||
      pathname.startsWith("/dashboard/pending")
    );
  }

  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname.startsWith(href);
};

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-bottom-nav-item ${active ? "active" : ""}`}
          >
            <span className="mobile-bottom-nav-icon-wrap">
              <Icon className="mobile-bottom-nav-icon" />
            </span>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

