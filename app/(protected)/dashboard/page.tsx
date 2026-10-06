"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Crosshair,
  Fingerprint,
  Flag,
  Globe,
  Radar,
  ShieldCheck,
  TrendingUp,
  User as UserIcon,
} from "lucide-react";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import ScrapingProgress from "./_components/ScrapingProgress";
import { DetectiveIcon } from "@/public/svgIcons";
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

interface DashboardStats {
  level: number;
}

interface IdentityProfileSummary {
  fullName: string;
  usernames: string[];
  aliases: string[];
}

// --- Mock monitoring data ---------------------------------------------
// This dashboard isn't wired to a real scanning pipeline yet — there's no
// CV<->MERN discovery contract to call (see the Phase 2.0 plan). Numbers
// below match the Figma reference exactly for visual QA.

const MOCK_STATS = {
  urlsDetected: { value: "1,284", delta: "+124 this week" },
  matchesIncidents: { value: "24", delta: "+6 this week" },
  newIncidents: { value: "8", delta: "+2 this week" },
  avgConfidence: { value: "96%", deltaLabel: "This week" },
};

// Scan cadence per plan — display-only for now (no real scheduler yet).
// Cloak Pro is provisionally daily per your call; explicitly a placeholder
// pending real cost/volume data from Phase 2.0.
const SCAN_SCHEDULE: Record<
  PlanCode,
  { frequencyLabel: string; countdownLabel: string }
> = {
  FREEMIUM: { frequencyLabel: "Next Month", countdownLabel: "In 21 days" },
  BOOST: { frequencyLabel: "After 15 Days", countdownLabel: "In 7d 23h" },
  CLOAK_PRO: { frequencyLabel: "Daily", countdownLabel: "In 5h 26m" },
};

function StatCard({
  bgClassName,
  circleClassName,
  iconColorClassName,
  Icon,
  label,
  value,
  trendLabel,
  trendColorClassName,
  showTrendIcon,
}: {
  bgClassName: string;
  circleClassName: string;
  iconColorClassName: string;
  Icon: typeof Globe;
  label: string;
  value: string | number;
  trendLabel: string;
  trendColorClassName: string;
  showTrendIcon: boolean;
}) {
  return (
    <div className={`rounded-[20px] px-2.5 pb-3.5 pt-2.5 ${bgClassName}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] leading-4 text-[#839297]">{label}</p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${circleClassName}`}
        >
          <Icon className={`h-4 w-4 ${iconColorClassName}`} />
        </div>
      </div>
      <div className="mt-[18px] flex items-end justify-between gap-2 max-[399px]:flex-col max-[399px]:items-start">
        <p
          className={`flex items-center gap-0.5 text-[10px] font-medium leading-6 whitespace-nowrap ${trendColorClassName}`}
        >
          {showTrendIcon && <TrendingUp className="h-6 w-6 shrink-0" />}
          {trendLabel}
        </p>
        <p className="text-[20px] font-medium leading-6 text-[#2B2B2B]">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [identityProfile, setIdentityProfile] =
    useState<IdentityProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // Full-screen "Scraping Posts" takeover — shown for the real Scan Now
  // action (not replayed for every already-discovered link the way it used
  // to be under Cloak Watch's per-link pages).
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
    setScanning(true);
    setScanError(null);
    setShowScrapingOverlay(true);
    try {
      const res = await fetch("/api/fetch-urls", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Scan could not be started.");
      }
      await fetchScanResults();
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "Scan could not be started.",
      );
      // No point leaving the overlay up over an error state it doesn't
      // know how to show — the existing inline scanError message below
      // the button already covers that.
      setShowScrapingOverlay(false);
    } finally {
      setScanning(false);
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
  // wait, and on identityProfile because the carousel only mounts once the
  // profile has loaded.
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
  }, [loading, isFreemiumPlan, activeScanSlide, identityProfile]);

  useEffect(() => {
    fetchScanResults();
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return;
        setUser(data.user);
        setStats(data.stats);
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
        <ScrapingProgress
          isComplete={!scanning}
          onBack={() => setShowScrapingOverlay(false)}
          onOk={() => router.push("/cloak-watch")}
        />
      )}
      <div className="space-y-4 pb-2">
      {/* Username block is absolutely centered on the screen (not just in
          the space between the avatar and the Scout label, which have
          different widths) — matches the reference. */}
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
        <div className="flex shrink-0 items-center gap-2 pt-0.5 text-[12px] leading-4 text-[#839297]">
          <DetectiveIcon className="h-3.5 w-3.5" />
          {stats && stats.level > 0 ? `Level ${stats.level}` : "Scout"}
        </div>
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
              className={`flex w-full flex-col justify-between gap-3 rounded-[20px] bg-white p-3.5 ${
                plan === "FREEMIUM" ? "shrink-0 snap-center snap-always" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center">
                  <div className="min-w-0">
                    <p className="text-[12px] leading-4 text-[#A7ADB2]">Last scan</p>
                    <p className="mt-0.5 text-[14px] leading-5 text-[#2B2B2B]">12 min ago</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] leading-4 text-[#A7ADB2]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-[#33C757] text-white" />
                      Completed
                    </p>
                  </div>
                  <div className="mx-2.5 h-[53px] w-px shrink-0 bg-[#F4F4F4]" />
                  <div className="min-w-0">
                    <p className="text-[12px] leading-4 text-[#A7ADB2]">Next scheduled scan</p>
                    <p className="mt-0.5 text-[14px] leading-5 text-[#2B2B2B]">
                      {schedule.frequencyLabel}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] leading-4 text-[#A7ADB2]">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {schedule.countdownLabel}
                    </p>
                  </div>
                </div>

                <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center">
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

              <div>
                <button
                  type="button"
                  onClick={handleScanNow}
                  disabled={scanning}
                  className="flex h-7 min-w-[89px] items-center justify-center gap-2 rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white disabled:opacity-60"
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
                  <p className="mt-2 text-center text-[12px] text-[#D14343]">
                    {scanError}
                  </p>
                )}
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
                Add your name, usernames &amp; aliases so we know what to
                monitor for you.
              </p>
              <Link
                href="/identity-profile"
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

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          bgClassName="bg-[#E9F9F6]"
          circleClassName="bg-[#D4EFE8]"
          iconColorClassName="text-[#209066]"
          Icon={Globe}
          label="URLs Detected"
          value={hasRequiredIdentityDetails ? detectedUrls.length : "0"}
          trendLabel={
            hasRequiredIdentityDetails
              ? MOCK_STATS.urlsDetected.delta
              : "Monitoring Disabled"
          }
          trendColorClassName={
            hasRequiredIdentityDetails ? "text-[#209066]" : "text-[#839297]"
          }
          showTrendIcon={hasRequiredIdentityDetails}
        />
        <StatCard
          bgClassName="bg-[#FFF1E6]"
          circleClassName="bg-[#FFE6D0]"
          iconColorClassName="text-[#FE8D27]"
          Icon={Crosshair}
          label="Matches"
          value={hasRequiredIdentityDetails ? MOCK_STATS.matchesIncidents.value : "0"}
          trendLabel={
            hasRequiredIdentityDetails
              ? MOCK_STATS.matchesIncidents.delta
              : "Monitoring Disabled"
          }
          trendColorClassName={
            hasRequiredIdentityDetails ? "text-[#FE8D27]" : "text-[#839297]"
          }
          showTrendIcon={hasRequiredIdentityDetails}
        />
        <StatCard
          bgClassName="bg-[#FFF0F3]"
          circleClassName="bg-[#FFD7E0]"
          iconColorClassName="text-[#F30131]"
          Icon={Flag}
          label="New Incidents"
          value={hasRequiredIdentityDetails ? MOCK_STATS.newIncidents.value : "0"}
          trendLabel={
            hasRequiredIdentityDetails
              ? MOCK_STATS.newIncidents.delta
              : "Monitoring Disabled"
          }
          trendColorClassName={
            hasRequiredIdentityDetails ? "text-[#F30131]" : "text-[#839297]"
          }
          showTrendIcon={hasRequiredIdentityDetails}
        />
        <StatCard
          bgClassName="bg-[#ECF2FE]"
          circleClassName="bg-[#D5E5FF]"
          iconColorClassName="text-[#0A63FB]"
          Icon={BarChart3}
          label="AVG Match Conf"
          value={hasRequiredIdentityDetails ? MOCK_STATS.avgConfidence.value : "—"}
          trendLabel={
            hasRequiredIdentityDetails
              ? MOCK_STATS.avgConfidence.deltaLabel
              : "Monitoring Disabled"
          }
          trendColorClassName={
            hasRequiredIdentityDetails ? "text-[#0A63FB]" : "text-[#839297]"
          }
          showTrendIcon={hasRequiredIdentityDetails}
        />
      </div>

      <div>
        <p className="mb-2.5 text-[16px] font-medium leading-[22px] text-[#2B2B2B]">Your Activity</p>
        <div className="space-y-3">
          <Link href="/reports" className="block">
            <div className="flex h-[60px] items-center gap-3 rounded-2xl bg-[#F5F5F7] px-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
                <AlertTriangle className="h-4 w-4 text-[#F30131]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] leading-[22px] text-[#2B2B2B]">Reports</p>
                <p className="truncate text-[12px] leading-4 text-[#839297]">
                  Reports from other users
                </p>
              </div>
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
              <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#2B2B2B]" />
            </div>
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
