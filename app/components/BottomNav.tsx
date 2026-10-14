"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloakWatchNavIcon,
  CommunityNavIcon,
  HomeNavIcon,
  ProfileNavIcon,
  SubmitReportNavIcon,
} from "../../public/svgIcons";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: HomeNavIcon },
  { href: "/cloak-watch", label: "Cloak Watch", icon: CloakWatchNavIcon },
  { href: "/submit-report", label: "Submit Report", icon: SubmitReportNavIcon },
  { href: "/community", label: "Community", icon: CommunityNavIcon },
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
                <Icon
                  isActive={active}
                  size={24}
                  activeColor="#00C3D0"
                  inactiveColor="#94a3b8"
                />
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