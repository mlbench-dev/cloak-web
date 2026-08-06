"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertsNavIcon,
  CloakWatchNavIcon,
  HomeNavIcon,
  ProfileNavIcon,
  SubmitReportNavIcon,
} from "../../public/svgIcons";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: HomeNavIcon },
  { href: "/cloak-watch", label: "Cloak Watch", icon: CloakWatchNavIcon },
  { href: "/submit-report", label: "Submit Report", icon: SubmitReportNavIcon },
  { href: "/alerts", label: "Alerts", icon: AlertsNavIcon },
  { href: "/profile", label: "Profile", icon: ProfileNavIcon },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/profile") {
    return (
      pathname === "/profile" ||
      pathname.startsWith("/profile/") ||
      pathname === "/my-reports" ||
      pathname.startsWith("/my-reports/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  // Dev-only React Strict Mode runs effect->cleanup->effect once per mount
  // to surface missing cleanup logic, which was firing this fetch twice for
  // the same pathname. Keying the guard on the pathname itself (rather than
  // a one-shot "already fetched" flag) skips that phantom second run while
  // still refetching on every genuine navigation.
  const lastFetchedPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastFetchedPathnameRef.current === pathname) return;
    lastFetchedPathnameRef.current = pathname;

    let cancelled = false;

    fetch("/api/alerts/unread-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) {
          setUnreadAlerts(data.count);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
    // Re-check whenever the route changes — e.g. right after leaving
    // /alerts, once it's marked the current alerts as viewed.
  }, [pathname]);

  return (
    <nav className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
      <ul className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center transition ${
                  active
                    ? "text-primary"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <span className="relative inline-flex">
                  <Icon
                    isActive={active}
                    size={24}
                    activeColor="#00C3D0"
                    inactiveColor="#94a3b8"
                  />
                  {item.href === "/alerts" && unreadAlerts > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[9px] font-semibold leading-none text-white">
                      {unreadAlerts > 9 ? "9+" : unreadAlerts}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium leading-tight">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}