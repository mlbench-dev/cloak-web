"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// Settings-style list rows (Profile, Identity Profile): a pastel icon tile,
// a title with an optional grey subtitle, and a chevron.

export function MenuButton({
  icon,
  label,
  description,
  onClick,
  variant = "default",
  showDivider = false,
  iconBg,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  variant?: "default" | "danger";
  showDivider?: boolean;
  // Each row gets its own pastel badge color per the reference design —
  // falls back to the old two-tone (teal/red) behavior when not given.
  iconBg?: string;
}) {
  return (
    <div>
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between gap-2 py-2.5 pl-3 pr-2 text-left active:scale-[0.99] transition-all"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Faint outline over the pastel tile, like the reference */}
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] ${
              iconBg || (variant === "danger" ? "bg-[#FFF1F1]" : "bg-[#E8F7FA]")
            }`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">{label}</p>
            {description && (
              <p className="truncate text-[12px] leading-4 text-[#A7ADB2]">
                {description}
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#9AB1B7]" />
      </button>
      {/* Inset divider: starts under the label, stops 12px short of the
          right edge — matches the reference, not full-width. */}
      {showDivider && <div className="ml-[54px] mr-3 h-px bg-[#E6F0EF]" />}
    </div>
  );
}

export function MenuGroup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#E6F0F1] bg-white">
      {children}
    </div>
  );
}
