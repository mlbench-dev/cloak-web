"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crosshair,
  Fingerprint,
  Flag,
  Globe,
  Radar,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import { detectPlatform } from "@/lib/platform";
import type { PlanCode } from "@/models/Subscription";
import { IncidentStatusPill, PlatformIcon } from "../incidents/_components/IncidentUI";
import { MOCK_INCIDENTS } from "../incidents/_lib/incidents";

// --- Types matching the real /api/user/dashboard payload (unchanged from
// before this redesign — only the achievements/XP-bar/old-3-stat UI that
// consumed part of this was dropped, see the summary note below) ---
interface DashboardUser {
  username: string;
  name: string;
  image?: string;
  profileImage?: string;
  isVerified: boolean;
  identityVerificationStatus?: string;
  role: string;
  plan: PlanCode;
}

interface DashboardStats {
  level: number;
}

interface IdentityProfileSummary {
  fullName: string;
  usernames: string[];
  aliases: string[];
}

interface DashboardRecentActivity {
  _id: string;
  platform: string;
  sourceLink: string;
  reportedByUser: {
    username: string;
    name?: string;
    image?: string;
    profileImage?: string;
  };
  status: string;
  createdAt: string;
}

// --- Mock monitoring data ---------------------------------------------
// This dashboard isn't wired to a real scanning pipeline yet — there's no
// CV<->MERN discovery contract to call (see the Phase 2.0 plan). Numbers
// below match the Figma reference exactly for visual QA. The "Recent
// Reports" tab below IS real data (reused from the existing
// /api/user/dashboard endpoint); only monitoring stats + incidents are mock.

// Incident types/mock data now live in ../incidents/_lib/incidents.ts,
// shared with the Incidents list/detail pages so this preview never drifts
// out of sync with the full list.

const PLATFORM_ICON: Record<string, string> = {
  instagram: "/images/social-media/insta.svg",
  tiktok: "/images/social-media/tiktok.svg",
  twitter: "/images/social-media/twitter.svg",
  facebook: "/images/social-media/facebook.svg",
  other: "/images/social-media/globe.svg",
};

// Derives the icon straight from the report's actual URL (same detection
// used at submission time in app/api/reports/route.ts) rather than trusting
// a possibly-stale stored platform field.
function iconForLink(link: string): string {
  return PLATFORM_ICON[detectPlatform(link)] || PLATFORM_ICON.other;
}

const MOCK_STATS = {
  urlsDetected: { value: "1,284", delta: "+124 this week" },
  matchesIncidents: { value: "24", delta: "+6 this week" },
  newIncidents: { value: "8", delta: "+2 this week" },
  avgConfidence: { value: "96%", deltaLabel: "This week" },
};

// Scan cadence per plan — display-only for now (no real scheduler yet).
// Cloak Pro is provisionally daily per your call; explicitly a placeholder
// pending real cost/volume data from Phase 2.0.
const SCAN_SCHEDULE: Record<PlanCode, { frequencyLabel: string; countdownLabel: string }> = {
  FREEMIUM: { frequencyLabel: "Next Month", countdownLabel: "In 21 days" },
  BOOST: { frequencyLabel: "After 15 Days", countdownLabel: "In 7d 23h" },
  CLOAK_PRO: { frequencyLabel: "Daily", countdownLabel: "In 5h 26m" },
};

function StatusPill({ status }: { status: string }) {
  const isPositive = status === "New" || status === "Verified" || status === "Approved";
  const isNegative = status === "Rejected";
  const tone = isNegative
    ? "bg-[#FFEDED] text-[#D14343]"
    : isPositive
      ? "bg-[#E4F9EE] text-[#1FAE5C]"
      : "bg-[#FFEDED] text-[#D14343]";
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-3 text-[12px] font-medium ${tone}`}>
      {status}
    </span>
  );
}

function ActivityRow({
  iconSrc,
  title,
  subtitle,
  status,
  href,
}: {
  iconSrc: string;
  title: string;
  subtitle: string;
  status: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3 rounded-2xl bg-[#F5F5F5] px-3.5 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
        <Image src={iconSrc} alt="" width={22} height={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-[#2D2D2D]">{title}</p>
        <p className="mt-0.5 text-[12px] text-[#8F98A0]">{subtitle}</p>
      </div>
      <StatusPill status={status} />
      <ChevronRight className="h-4 w-4 shrink-0 text-[#B5BEC4]" />
    </div>
  );

  return href ? (
    // `Link` renders an <a>, which is inline by default — without `block`
    // it and its siblings can end up flowing together instead of each
    // fully claiming their own row, which is what was collapsing the
    // space-y-3 gap between these cards.
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<DashboardRecentActivity[]>([]);
  const [identityProfile, setIdentityProfile] = useState<IdentityProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reports" | "incidents">("incidents");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return;
        setUser(data.user);
        setStats(data.stats);
        setRecentActivity(data.recentActivity || []);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/identity-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) setIdentityProfile(data.profile);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
      </div>
    );
  }

  const plan: PlanCode = user?.plan || "FREEMIUM";
  const schedule = SCAN_SCHEDULE[plan];
  // Monitoring needs a name plus at least one username/alias to search
  // against — Known Websites/Keywords are explicitly optional on that form,
  // so they don't gate readiness here.
  const hasRequiredIdentityDetails =
    !!identityProfile?.fullName?.trim() &&
    (identityProfile?.usernames?.length ?? 0) > 0 &&
    (identityProfile?.aliases?.length ?? 0) > 0;
  const avatarUrl = user?.image || user?.profileImage;
  const isVerified = user?.identityVerificationStatus === "APPROVED" || user?.isVerified || false;

  const reportRows = recentActivity.map((activity) => {
    const status =
      activity.status === "VERIFIED" || activity.status === "APPROVED"
        ? "Verified"
        : activity.status === "FALSE_POSITIVE" || activity.status === "REJECTED"
          ? "Rejected"
          : "Pending";
    return {
      key: activity._id,
      iconSrc: iconForLink(activity.sourceLink),
      title: activity.sourceLink,
      subtitle: `Reported by @${activity.reportedByUser?.username || "user"}`,
      status,
      href: `/reports/${activity._id}`,
    };
  });

  return (
    <div className="space-y-6 pb-2">
      <div className="flex items-center gap-3">
        <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full bg-gray-200">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={user?.username || "user"} fill className="object-cover" />
          ) : (
            <UserIcon className="h-full w-full p-3 text-gray-400" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[17px] font-medium text-[#2D2D2D]">{user?.username || "user"}</h2>
            {isVerified && <VerifiedBadge className="h-5 w-5 text-[#14C3CF]" />}
          </div>
          <div
            className={`mt-0.5 flex items-center gap-1 text-[13px] font-medium ${
              hasRequiredIdentityDetails ? "text-[#19C48A]" : "text-[#8F98A0]"
            }`}
          >
            <Radar className="h-4 w-4" />
            {hasRequiredIdentityDetails ? "Monitoring Active" : "Monitoring Disabled"}
          </div>
          <p className="mt-0.5 text-[13px] text-[#8F98A0]">
            {stats && stats.level > 0 ? `Level ${stats.level} Scout` : "Unranked"}
          </p>
        </div>
      </div>

      {hasRequiredIdentityDetails ? (
        <div className="flex items-center gap-3 rounded-[24px] bg-[#EEFFF2] p-5">
          <div className="grid flex-1 grid-cols-2">
            <div>
              <p className="text-[13px] text-[#8F98A0]">Last scan</p>
              <p className="mt-1 text-[16px] font-semibold text-[#2D2D2D]">12 min ago</p>
              <p className="mt-1 flex items-center gap-1 text-[12px] text-[#1FAE5C]">
                <CheckCircle2 className="h-3.5 w-3.5 fill-[#1FAE5C] text-[#EEFFF2]" />
                Completed
              </p>
            </div>
            <div className="border-l border-[#34C759]/25 pl-4">
              <p className="text-[13px] text-[#8F98A0]">Next  scan</p>
              <p className="mt-1 text-[16px] font-semibold text-[#2D2D2D]">{schedule.frequencyLabel}</p>
              <p className="mt-1 flex items-center gap-1 text-[12px] text-[#8F98A0]">
                <Clock className="h-3.5 w-3.5" />
                {schedule.countdownLabel}
              </p>
            </div>
          </div>

          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <Image
              src="/Sonar_Radar.svg"
              alt=""
              aria-hidden="true"
              fill
              className="absolute inset-0"
            />
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#34C759]">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-[24px] bg-[#E8FEFF] p-5">
          <div className="flex-1">
            <p className="text-[13px] text-[#8F98A0]">Monitoring Paused</p>
            <p className="mt-1 text-[16px] font-semibold text-[#2D2D2D]">
              Complete Your Identity Profile
            </p>
            <p className="mt-1 text-[12px] text-[#8F98A0]">
              Add your name, usernames &amp; aliases so we know what to monitor for you.
            </p>
            <Link
              href="/identity-profile"
              className="mt-3 inline-flex h-10 items-center rounded-full bg-[#14C3CF] px-5 text-[14px] font-medium text-white"
            >
              Complete Profile
            </Link>
          </div>
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#14C3CF]">
            <Fingerprint className="h-8 w-8 text-white" />
          </div>
        </div>
      )}

      {plan === "FREEMIUM" && (
        <div className="flex items-center gap-3 rounded-[20px] bg-[#F5F5F5] p-4">
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-[#2D2D2D]">Need faster monitoring?</p>
            <p className="mt-0.5 text-[13px] text-[#8F98A0]">Get premium and unlock pro monitoring</p>
            <Link
              href="/subscription"
              className="mt-3 inline-flex h-10 items-center rounded-full bg-[#14C3CF] px-5 text-[14px] font-medium text-white"
            >
              Subscribe
            </Link>
          </div>
          <Image
            src="/subscription.svg"
            alt=""
            aria-hidden="true"
            width={74}
            height={74}
            className="h-[74px] w-[74px] shrink-0"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#F0F0F0] p-4">
          <div className="flex items-center justify-between gap-2 max-[399px]:flex-col max-[399px]:items-start">
            <Globe className="h-6 w-6 shrink-0 text-[#5AB8E0]" />
            <span
              className={`text-[12px] font-medium whitespace-nowrap ${
                hasRequiredIdentityDetails ? "text-[#5AB8E0]" : "text-[11px] text-[#8F98A0]"
              }`}
            >
              {hasRequiredIdentityDetails ? MOCK_STATS.urlsDetected.delta : "Monitoring Disabled"}
            </span>
          </div>
          <p className="mt-4 text-[13px] text-[#8F98A0]">URLs Detected</p>
          <p className="text-[22px] font-semibold text-[#2D2D2D]">
            {hasRequiredIdentityDetails ? MOCK_STATS.urlsDetected.value : "0"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#F0F0F0] p-4">
          <div className="flex items-center justify-between gap-2 max-[399px]:flex-col max-[399px]:items-start">
            <Crosshair className="h-6 w-6 shrink-0 text-[#E88A3B]" />
            <span
              className={`text-[12px] font-medium whitespace-nowrap ${
                hasRequiredIdentityDetails ? "text-[#E88A3B]" : "text-[11px] text-[#8F98A0]"
              }`}
            >
              {hasRequiredIdentityDetails ? MOCK_STATS.matchesIncidents.delta : "Monitoring Disabled"}
            </span>
          </div>
          <p className="mt-4 text-[13px] text-[#8F98A0]">Matches / Incidents</p>
          <p className="text-[22px] font-semibold text-[#2D2D2D]">
            {hasRequiredIdentityDetails ? MOCK_STATS.matchesIncidents.value : "0"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#F0F0F0] p-4">
          <div className="flex items-center justify-between gap-2 max-[399px]:flex-col max-[399px]:items-start">
            <Flag className="h-6 w-6 shrink-0 text-[#E0577B]" />
            <span
              className={`text-[12px] font-medium whitespace-nowrap ${
                hasRequiredIdentityDetails ? "text-[#D14343]" : "text-[11px] text-[#8F98A0]"
              }`}
            >
              {hasRequiredIdentityDetails ? MOCK_STATS.newIncidents.delta : "Monitoring Disabled"}
            </span>
          </div>
          <p className="mt-4 text-[13px] text-[#8F98A0]">New Incidents</p>
          <p className="text-[22px] font-semibold text-[#2D2D2D]">
            {hasRequiredIdentityDetails ? MOCK_STATS.newIncidents.value : "0"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#F0F0F0] p-4">
          <div className="flex items-center justify-between gap-2 max-[399px]:flex-col max-[399px]:items-start">
            <BarChart3 className="h-6 w-6 shrink-0 text-[#4C7DF0]" />
            <span
              className={`text-[12px] font-medium whitespace-nowrap ${
                hasRequiredIdentityDetails ? "text-[#4C7DF0]" : "text-[11px] text-[#8F98A0]"
              }`}
            >
              {hasRequiredIdentityDetails ? MOCK_STATS.avgConfidence.deltaLabel : "Monitoring Disabled"}
            </span>
          </div>
          <p className="mt-4 text-[13px] text-[#8F98A0]">Avg Match Confidence</p>
          <p className="text-[22px] font-semibold text-[#2D2D2D]">
            {hasRequiredIdentityDetails ? MOCK_STATS.avgConfidence.value : "—"}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("reports")}
              className={`h-9 rounded-full px-4 text-[13px] font-medium transition-all ${
                tab === "reports" ? "bg-[#14C3CF] text-white" : "bg-[#F3F3F3] text-[#4B4B4B]"
              }`}
            >
              Recent Reports
            </button>
            <button
              type="button"
              onClick={() => setTab("incidents")}
              className={`h-9 rounded-full px-4 text-[13px] font-medium transition-all ${
                tab === "incidents" ? "bg-[#14C3CF] text-white" : "bg-[#F3F3F3] text-[#4B4B4B]"
              }`}
            >
              Recent Incidents
            </button>
          </div>
          <Link
            href={tab === "reports" ? "/reports" : "/incidents"}
            className="text-[13px] font-medium text-[#14C3CF]"
          >
            View All
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {tab === "incidents"
            ? MOCK_INCIDENTS.slice(0, 4).map((incident) => (
                <Link key={incident.id} href={`/incidents/${incident.id}`} className="block">
                  <div className="flex items-center gap-3 rounded-2xl bg-[#F5F5F5] px-3.5 py-3">
                    <PlatformIcon platform={incident.platform} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-[#2D2D2D]">
                        {incident.urlLabel}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#8F98A0]">
                        Detected {incident.detectedAgo} • {incident.matchPercent}% match
                      </p>
                    </div>
                    <IncidentStatusPill status={incident.status} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#B5BEC4]" />
                  </div>
                </Link>
              ))
            : reportRows.length > 0
              ? reportRows.map((row) => (
                  <ActivityRow
                    key={row.key}
                    iconSrc={row.iconSrc}
                    title={row.title}
                    subtitle={row.subtitle}
                    status={row.status}
                    href={row.href}
                  />
                ))
              : (
                <p className="py-6 text-center text-[13px] text-[#8F98A0]">No reports yet</p>
              )}
        </div>
      </div>
    </div>
  );
}
