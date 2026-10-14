"use client";

import { Globe } from "lucide-react";

// Shared by My Reports, Reports (received) and Report Details so the
// status wording, colours, filters and platform icons stay identical
// across both sides of a report.

export type ReportFilter = "all" | "PENDING" | "VERIFIED" | "REJECTED";

export const REPORT_FILTERS: { id: ReportFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "VERIFIED", label: "Verified" },
  { id: "REJECTED", label: "Rejected" },
];

// The API has used two names for each resolved state over time.
export function getReportStatusGroup(
  status: string,
): Exclude<ReportFilter, "all"> | null {
  if (status === "VERIFIED" || status === "APPROVED") return "VERIFIED";
  if (status === "REJECTED" || status === "FALSE_POSITIVE") return "REJECTED";
  if (status === "PENDING") return "PENDING";
  return null;
}

export function matchesReportFilter(status: string, filter: ReportFilter) {
  return filter === "all" || getReportStatusGroup(status) === filter;
}

const STATUS_META: Record<
  Exclude<ReportFilter, "all">,
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "text-[#FE8D27]" },
  VERIFIED: { label: "Verified", className: "text-[#14C3CF]" },
  REJECTED: { label: "Rejected", className: "text-[#F30131]" },
};

export function getReportStatusMeta(status: string) {
  const group = getReportStatusGroup(status);
  return group ? STATUS_META[group] : { label: "", className: "text-[#839297]" };
}

export function formatReportTimeAgo(value?: string) {
  if (!value) return "";
  const diffMinutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return `${Math.floor(diffMinutes / 1440)}d ago`;
}

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X",
  x: "X",
  tiktok: "TikTok",
};

export function getSourceDomain(link: string) {
  try {
    return new URL(link).hostname;
  } catch {
    return link;
  }
}

export function getSourceLinkLabel(link: string) {
  try {
    const parsed = new URL(link);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}${parsed.search}`;
  } catch {
    return link;
  }
}

// Single-colour platform glyph drawn in currentColor. The full-colour brand
// SVGs in /images/social-media can't be recoloured, so Instagram/Facebook
// are drawn here and X/TikTok (single-silhouette files) are used as a mask.
export function PlatformGlyph({
  platform,
  size,
}: {
  platform: string;
  size: number;
}) {
  if (platform === "instagram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.25" cy="6.75" r="1.25" fill="currentColor" />
      </svg>
    );
  }

  if (platform === "facebook") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
      </svg>
    );
  }

  const maskSrc =
    platform === "twitter" || platform === "x"
      ? "/images/social-media/twitter.svg"
      : platform === "tiktok"
        ? "/images/social-media/tiktok.svg"
        : null;

  if (maskSrc) {
    // Mask glyphs have no padding of their own, so draw them a bit smaller.
    const maskSize = Math.round(size * 0.8);
    return (
      <span
        aria-hidden="true"
        className="block bg-current"
        style={{
          width: maskSize,
          height: maskSize,
          maskImage: `url(${maskSrc})`,
          WebkitMaskImage: `url(${maskSrc})`,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    );
  }

  return <Globe width={size} height={size} />;
}

// White glyph on a teal rounded square — used on Report Details.
export function PlatformTile({ platform }: { platform: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#14C3CF] text-white">
      <PlatformGlyph platform={platform} size={18} />
    </div>
  );
}

// Grey glyph in an outlined circle — the leading icon on report list rows.
export function PlatformCircle({ platform }: { platform: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#839297]">
      <PlatformGlyph platform={platform} size={20} />
    </div>
  );
}

export function ReportFilterPills({
  active,
  onChange,
  getCount,
}: {
  active: ReportFilter;
  onChange: (filter: ReportFilter) => void;
  getCount: (filter: ReportFilter) => number;
}) {
  return (
    <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar">
      {REPORT_FILTERS.map((filter) => {
        const isActive = active === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onChange(filter.id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] leading-4 transition-colors ${
              isActive ? "bg-[#14C3CF] text-white" : "bg-[#F5F5F5] text-[#2B2B2B]"
            }`}
          >
            {filter.label}
            <span className={isActive ? "text-white/80" : "text-[#839297]"}>
              {" "}({getCount(filter.id)})
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Right-hand column of a list row: status on top, age underneath. Pass
// `platform` when the row's leading icon isn't already the platform.
export function ReportRowMeta({
  status,
  createdAt,
  platform,
}: {
  status: string;
  createdAt?: string;
  platform?: string;
}) {
  const meta = getReportStatusMeta(status);
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <p className={`text-[12px] leading-4 ${meta.className}`}>{meta.label}</p>
      <p className="flex items-center gap-1 text-[12px] leading-4 text-[#A7ADB2]">
        {platform && <PlatformGlyph platform={platform} size={12} />}
        {formatReportTimeAgo(createdAt)}
      </p>
    </div>
  );
}
