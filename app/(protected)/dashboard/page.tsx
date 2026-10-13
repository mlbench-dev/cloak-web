"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  Crown,
  Crosshair,
  Fingerprint,
  Globe,
  Radar,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import {
  ScrapingLinksScreen,
  describeMissingProfile,
  profileCompletionHref,
  useLinkFetchStatus,
} from "@/app/components/linkDiscovery/LinkDiscovery";
import { useNotifications } from "@/app/components/NotificationsProvider";
import type { PlanCode } from "@/models/Subscription";
import { PLAN_DISPLAY_NAME } from "@/lib/config";

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

// --- Mock monitoring data ---------------------------------------------
// This dashboard isn't wired to a real scanning pipeline yet — there's no
// CV<->MERN discovery contract to call (see the Phase 2.0 plan). Numbers
// below match the Figma reference exactly for visual QA.

const MOCK_STATS = {
  matches: "24",
  avgConfidence: "96%",
  pendingReports: 12,
  newCloakWatchMatches: 6,
};

function StatCard({
  bgClassName,
  circleClassName,
  trendColorClassName,
  Icon,
  label,
  value,
  trendLabel,
}: {
  bgClassName: string;
  circleClassName: string;
  trendColorClassName: string;
  Icon: typeof Globe;
  label: string;
  value: string | number;
  trendLabel: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col rounded-[16px] p-2.5 ${bgClassName}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${circleClassName}`}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="mt-2 text-xs leading-4 text-[#839297]">{label}</p>
      <div className="mt-auto flex items-baseline justify-between gap-1 pt-4">
        <p className="text- font-medium leading-6 text-[#2B2B2B]">{value}</p>
        <p className={`truncate text-[10px] leading-4 ${trendColorClassName}`}>
          {trendLabel}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { unreadCount: unreadAlerts } = useNotifications();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  // Scan runs link discovery as a background job on the server; this
  // follows it (it may also have been started from the identity profile).
  const {
    status: linkFetch,
    start: startLinkFetch,
    refresh: refreshLinkFetch,
  } = useLinkFetchStatus();
  const scanning = linkFetch?.status === "running";
  // Full-screen Scraping Links screen for the Scan action.
  const [showScrapingOverlay, setShowScrapingOverlay] = useState(false);

  // Shared by the mount effect below and handleScanNow, so a completed
  // scan can refresh the same data without a full page reload.
  const fetchScanResults = async () => {
    try {
      const res = await fetch("/api/scan-results");
      const data = await res.json().catch(() => null);
      if (data?.success) setDetectedUrls(data.urls || []);
    } catch {
      // leave detectedUrls as-is on a transient failure
    }
  };

  const handleScanNow = async () => {
    setScanError(null);
    setShowScrapingOverlay(true);
    const error = await startLinkFetch();
    if (error) {
      // Couldn't even start — show it inline under the button instead.
      setScanError(error);
      setShowScrapingOverlay(false);
    }
  };
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);

  // Swipeable scan-status/upsell carousel — tracks which slide is centered
  // so the dot indicator can reflect it (native CSS scroll-snap, no carousel
  // library needed for just two slides).
  const scanCarouselRef = useRef<HTMLDivElement>(null);
  const [activeScanSlide, setActiveScanSlide] = useState(0);
  const handleScanCarouselScroll = () => {
    const el = scanCarouselRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveScanSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  // Auto-advance the carousel every 3s (Freemium only — paid plans show a
  // single card). Keyed on activeScanSlide so a manual swipe restarts the
  // wait, and on profileComplete because the carousel only mounts once the
  // profile is known to be complete.
  const isFreemiumPlan = (user?.plan || "FREEMIUM") === "FREEMIUM";
  useEffect(() => {
    if (loading || !isFreemiumPlan) return;
    const timeout = setTimeout(() => {
      const el = scanCarouselRef.current;
      if (!el || el.clientWidth === 0) return;
      const next = (activeScanSlide + 1) % el.children.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 6000);
    return () => clearTimeout(timeout);
  }, [loading, isFreemiumPlan, activeScanSlide, linkFetch?.profileComplete]);

  useEffect(() => {
    fetchScanResults();
    void refreshLinkFetch();
  }, [refreshLinkFetch]);

  // Refresh the URL count once a run finishes.
  const linkFetchState = linkFetch?.status;
  useEffect(() => {
    if (linkFetchState === "done") fetchScanResults();
  }, [linkFetchState]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return;
        setUser(data.user);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
  // Same rule that gates the CV API (getProfileCompleteness in
  // lib/fetchLinks.ts): name, username, keyword and reference media.
  const hasRequiredIdentityDetails = linkFetch?.profileComplete ?? false;
  const missingProfile = linkFetch?.missingProfile ?? [];
  // Placeholder only once the user has loaded and is known to have no image.
  const avatarUrl = user
    ? user.image || user.profileImage || "/images/placeholder_avatar.png"
    : undefined;
  const isVerified =
    user?.identityVerificationStatus === "APPROVED" ||
    user?.isVerified ||
    false;

  return (
    <>
      {showScrapingOverlay && (
        <ScrapingLinksScreen
          status={linkFetch}
          onBack={() => setShowScrapingOverlay(false)}
          onRetry={() => void handleScanNow()}
          // Cloak Watch opens Confirm Links when there's anything to review.
          onOk={() => router.push("/cloak-watch")}
        />
      )}
      <div className="space-y-4 pb-2">
      {/* Username block is absolutely centered on the screen (not just in
          the space between the avatar and the alerts bell) — matches the
          reference. */}
      <div className="relative flex min-h-10 items-start justify-between">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={user?.username || "user"}
              fill
              className="object-cover"
            />
          ) : (
            <UserIcon className="h-full w-full p-1.5 text-gray-400" />
          )}
        </div>
        <div className="absolute left-1/2 top-0 max-w-[56%] -translate-x-1/2 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="truncate text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
              {user?.username || "user"}
            </h2>
            {isVerified && <VerifiedBadge className="h-3 w-3 shrink-0 text-[#33C757]" />}
          </div>
          <div
            className={`mt-px flex items-center justify-center gap-1 text-[13px] leading-[18px] ${
              hasRequiredIdentityDetails ? "text-[#0FB87F]" : "text-[#839297]"
            }`}
          >
            <Radar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {hasRequiredIdentityDetails
                ? "Monitoring Active"
                : "Monitoring Disabled"}
            </span>
          </div>
        </div>
        <Link
          href="/alerts"
          aria-label="Alerts"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#839297]"
        >
          <Bell className="h-4 w-4" fill="currentColor" />
          {unreadAlerts > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[9px] font-semibold leading-none text-white">
              {unreadAlerts > 9 ? "9+" : unreadAlerts}
            </span>
          )}
        </Link>
      </div>

      {hasRequiredIdentityDetails ? (
        <div
          className={`rounded-3xl bg-gradient-to-r from-[#02C4D0] to-[#21DBE7] px-1 pb-1 ${
            plan === "FREEMIUM" ? "pt-3" : "pt-2.5"
          }`}
        >
          {/* Paid plans have no carousel dots, so without this strip the
              gradient was just a thick outline around the card. */}
          {plan !== "FREEMIUM" && (
            <div className="mb-2.5 flex items-center justify-between gap-3 px-3">
              <p className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium leading-4 text-white">
                <Crown className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{PLAN_DISPLAY_NAME[plan]}</span>
              </p>
              <Link
                href="/subscription"
                className="flex shrink-0 items-center text-[12px] leading-4 text-white/90"
              >
                Manage plan
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
          {plan === "FREEMIUM" && (
            <div className="mb-3 flex h-1.5 items-center justify-center gap-1">
              <span
                className={`h-1.5 rounded-full transition-all ${
                  activeScanSlide === 0 ? "w-3 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
              <span
                className={`h-1.5 rounded-full transition-all ${
                  activeScanSlide === 1 ? "w-3 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            </div>
          )}

          <div
            ref={scanCarouselRef}
            onScroll={plan === "FREEMIUM" ? handleScanCarouselScroll : undefined}
            className={
              plan === "FREEMIUM"
                ? "flex items-stretch snap-x snap-mandatory overflow-x-auto no-scrollbar"
                : "flex items-stretch"
            }
          >
            {/* No extra wrapper div around this card on purpose — a plain
                flex item stretches to match its tallest sibling automatically
                (align-items: stretch is the default). Putting `h-full` on a
                wrapper *around* this card instead relied on percentage-height
                resolving through an auto-height ancestor, which is exactly
                the kind of circular case browsers don't reliably stretch —
                that's why the two slides ended up different heights even
                with h-full applied. Making the visible card itself the flex
                item sidesteps that entirely. */}
            <div
              className={`flex w-full items-center justify-between gap-3 rounded-[20px] bg-white p-3.5 ${
                plan === "FREEMIUM" ? "shrink-0 snap-center snap-always" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-0.5">
                  <p className="text-[12px] leading-4 text-[#A7ADB2]">Last scan</p>
                  <p className="flex items-center gap-1 text-[12px] leading-4 text-[#A7ADB2]">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-[#33C757] text-white" />
                    Completed
                  </p>
                </div>
                <p className="mt-1 text-[14px] leading-5 text-[#2B2B2B]">12 min ago</p>
                <button
                  type="button"
                  onClick={handleScanNow}
                  disabled={scanning}
                  className="mt-3 flex h-7 min-w-[89px] items-center justify-center gap-2 rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white disabled:opacity-60"
                >
                  {scanning ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Scanning…
                    </>
                  ) : (
                    "Scan"
                  )}
                </button>
                {scanError && (
                  <p className="mt-2 text-[12px] text-[#D14343]">{scanError}</p>
                )}
              </div>

              <div className="relative flex h-[80px] w-[80px] shrink-0 items-center justify-center">
                <Image
                  src="/Sonar_Radar.svg"
                  alt=""
                  aria-hidden="true"
                  fill
                  className="absolute inset-0"
                />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#34C759]">
                  <ShieldCheck className="h-[18px] w-[18px] text-white" />
                </div>
              </div>
            </div>

            {plan === "FREEMIUM" && (
              <div className="flex w-full shrink-0 snap-center snap-always items-center gap-3 rounded-[20px] bg-white p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">
                    Need faster monitoring?
                  </p>
                  <p className="text-[12px] leading-4 text-[#839297]">
                    Get premium and unlock pro monitoring
                  </p>
                  <Link
                    href="/subscription"
                    className="mt-3 inline-flex h-[30px] min-w-[89px] items-center justify-center rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white"
                  >
                    Subscribe
                  </Link>
                </div>
                <Image
                  src="/subscription.svg"
                  alt=""
                  aria-hidden="true"
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-3xl border border-[#C8EEF1] bg-[#E7F9FB] p-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] leading-4 text-[#839297]">Monitoring Paused</p>
              <p className="mt-0.5 text-[14px] font-medium leading-5 text-[#2B2B2B]">
                Complete Your Identity Profile
              </p>
              <p className="mt-0.5 text-[12px] leading-4 text-[#839297]">
                {describeMissingProfile(missingProfile)}
              </p>
              <Link
                href={profileCompletionHref(missingProfile)}
                className="mt-3 inline-flex h-[30px] items-center justify-center rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white"
              >
                Complete Profile
              </Link>
            </div>
            <div className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#00C3D0]">
              <Fingerprint className="h-5 w-5 text-white" />
            </div>
          </div>

          {plan === "FREEMIUM" && (
            <div className="flex items-center gap-3 rounded-[20px] bg-[#F5F5F7] p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">
                  Need faster monitoring?
                </p>
                <p className="text-[12px] leading-4 text-[#839297]">
                  Get premium and unlock pro monitoring
                </p>
                <Link
                  href="/subscription"
                  className="mt-3 inline-flex h-[30px] min-w-[89px] items-center justify-center rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white"
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
        </>
      )}

      <div className="grid grid-cols-3 gap-2">
        <StatCard
          bgClassName="bg-[#E9F9F6]"
          circleClassName="bg-[#209066]"
          trendColorClassName={
            hasRequiredIdentityDetails ? "text-[#209066]" : "text-[#839297]"
          }
          Icon={Globe}
          label="URLs Detected"
          value={hasRequiredIdentityDetails ? detectedUrls.length : "0"}
          trendLabel={hasRequiredIdentityDetails ? "this week" : "Paused"}
        />
        <StatCard
          bgClassName="bg-[#FFF1E6]"
          circleClassName="bg-[#FE8D27]"
          trendColorClassName={
            hasRequiredIdentityDetails ? "text-[#FE8D27]" : "text-[#839297]"
          }
          Icon={Crosshair}
          label="Matches"
          value={hasRequiredIdentityDetails ? MOCK_STATS.matches : "0"}
          trendLabel={hasRequiredIdentityDetails ? "this week" : "Paused"}
        />
        <StatCard
          bgClassName="bg-[#ECF2FE]"
          circleClassName="bg-[#0A63FB]"
          trendColorClassName={
            hasRequiredIdentityDetails ? "text-[#0A63FB]" : "text-[#839297]"
          }
          Icon={BarChart3}
          label="AVG Match Conf"
          value={hasRequiredIdentityDetails ? MOCK_STATS.avgConfidence : "—"}
          trendLabel={hasRequiredIdentityDetails ? "this week" : "Paused"}
        />
      </div>

      <div>
        <p className="mb-2.5 text-[16px] font-medium leading-[22px] text-[#2B2B2B]">Your Activity</p>
        <div className="space-y-3">
          <Link href="/reports" className="block">
            <div className="flex h-[60px] items-center gap-3 rounded-2xl bg-[#F5F5F7] px-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
                <ArrowDownToLine className="h-4 w-4 text-[#F30131]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] leading-[22px] text-[#2B2B2B]">Reports</p>
                <p className="truncate text-[12px] leading-4 text-[#839297]">
                  Reports from other users
                </p>
              </div>
              {hasRequiredIdentityDetails && MOCK_STATS.pendingReports > 0 && (
                <span className="shrink-0 text-[12px] leading-4 text-[#FE8D27]">
                  {MOCK_STATS.pendingReports} Pending
                </span>
              )}
              <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#2B2B2B]" />
            </div>
          </Link>
          <Link href="/cloak-watch" className="block">
            <div className="flex h-[60px] items-center gap-3 rounded-2xl bg-[#F5F5F7] px-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
                <Radar className="h-4 w-4 text-[#33C757]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] leading-[22px] text-[#2B2B2B]">Cloak Watch</p>
                <p className="truncate text-[12px] leading-4 text-[#839297]">
                  Matches found by Cloak
                </p>
              </div>
              {hasRequiredIdentityDetails &&
                MOCK_STATS.newCloakWatchMatches > 0 && (
                  <span className="shrink-0 text-[12px] leading-4 text-[#00C3D0]">
                    {MOCK_STATS.newCloakWatchMatches} New
                  </span>
                )}
              <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#2B2B2B]" />
            </div>
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
