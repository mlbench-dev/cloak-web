"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PlatformGlyph, getSourceLinkLabel } from "@/app/components/reports/reportUi";
import AddLinkSheet from "@/app/components/linkDiscovery/AddLinkSheet";
import type { CloakWatchOverview, WatchedLinkSummary } from "@/lib/cloakWatchPosts";
import { LINK_CHANGE_WINDOW_DAYS } from "@/lib/config";
import {
  ConfirmLinksScreen,
  ScrapingLinksScreen,
  ScrapingPostsScreen,
  describeMissingProfile,
  profileCompletionHref,
  useLinkFetchStatus,
} from "@/app/components/linkDiscovery/LinkDiscovery";

interface IdentityProfileResponse {
  success: boolean;
  profile: { fullName?: string } | null;
}

// Watched links with their scrape progress + new-post counts, and the
// stats card (GET /api/cloak-watch/links).
async function fetchOverview(): Promise<CloakWatchOverview | null> {
  try {
    const res = await fetch("/api/cloak-watch/links", { cache: "no-store" });
    const data = res.ok ? await res.json() : null;
    return data?.success ? (data as CloakWatchOverview) : null;
  } catch {
    return null;
  }
}

function formatAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function IncidentsPage() {
  const router = useRouter();
  const [links, setLinks] = useState<WatchedLinkSummary[]>([]);
  const [stats, setStats] = useState<CloakWatchOverview["stats"] | null>(null);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Link discovery runs as a background job; if one is running or has
  // links waiting for review, this screen shows it (it may have been
  // started from the identity profile and closed there).
  const {
    status: linkFetch,
    start: startLinkFetch,
    refresh: refreshLinkFetch,
    retryScrape,
    scrapePending,
    retrying: retryingScrape,
    applyStatus,
  } = useLinkFetchStatus();
  const handleRetryScrape = async () => {
    setPostsDismissed(false);
    const error = await retryScrape();
    if (error) toast.error(error, { id: "scrape-retry" });
  };
  const handleCheckLinks = async () => {
    setPostsDismissed(false);
    const error = await scrapePending();
    if (error) toast.error(error, { id: "scrape-retry" });
  };
  // Showing the Scraping Links screen; stays up after the run finishes
  // until the user taps Ok (or goes back).
  const [watchingScrape, setWatchingScrape] = useState(false);
  const [scrapeDismissed, setScrapeDismissed] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(false);

  // Same idea for post scraping, which starts after Confirm Links.
  const [watchingPosts, setWatchingPosts] = useState(false);
  const [postsDismissed, setPostsDismissed] = useState(false);
  const scrapeState = linkFetch?.scrape.status;
  if (scrapeState === "running" && !postsDismissed && !watchingPosts) {
    setWatchingPosts(true);
  }

  if (linkFetch?.status === "running" && !scrapeDismissed && !watchingScrape) {
    setWatchingScrape(true);
  }

  const applyOverview = (overview: CloakWatchOverview | null) => {
    if (!overview) return; // keep what's shown if a reload fails
    setLinks(overview.links);
    setStats(overview.stats);
  };
  const reloadUrls = () => fetchOverview().then(applyOverview);

  useEffect(() => {
    void refreshLinkFetch();
  }, [refreshLinkFetch]);

  // Reload the list on load and whenever a fetch or scrape moves on (a link
  // finishing updates its row and counts) — not on every status check.
  const progressKey = linkFetch
    ? `${linkFetch.status}|${linkFetch.scrape.status}|${linkFetch.scrape.finishedCount}`
    : "";
  useEffect(() => {
    let cancelled = false;
    fetchOverview().then((overview) => {
      if (cancelled) return;
      if (overview) {
        setLinks(overview.links);
        setStats(overview.stats);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [progressKey]);

  const showConfirm =
    !watchingScrape && Boolean(linkFetch?.awaitingReview) && !reviewDismissed;

  // Nothing can be fetched until every profile requirement is met (see
  // getProfileCompleteness in lib/fetchLinks.ts).
  const needsProfile = linkFetch !== null && !linkFetch.profileComplete;
  // Profile is ready but discovery has never run (e.g. the first fetch
  // failed or was never started) — offer to run it from here.
  const canStartFirstScan =
    linkFetch !== null &&
    linkFetch.profileComplete &&
    !linkFetch.everFetched &&
    linkFetch.status === "idle";
  // Links the user added that have never been scraped — e.g. an account
  // that finished its profile before completing it started scraping.
  // Offer to check them now instead of only offering link discovery.
  const uncheckedCount = links.filter(
    (link) => !link.scrapeStatus || link.scrapeStatus === "pending",
  ).length;
  const showCheckLinks =
    linkFetch !== null &&
    linkFetch.profileComplete &&
    uncheckedCount > 0 &&
    scrapeState !== "running" &&
    // A failed run has its own Try again banner.
    scrapeState !== "failed" &&
    linkFetch.status !== "running" &&
    !linkFetch.awaitingReview;
  const [startingScan, setStartingScan] = useState(false);

  const handleStartScan = async () => {
    if (startingScan) return;
    setStartingScan(true);
    setScrapeDismissed(false);
    const error = await startLinkFetch();
    setStartingScan(false);
    if (error) toast.error(error);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/identity-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: IdentityProfileResponse | null) => {
        if (!cancelled && data?.success) {
          setSubjectName(data.profile?.fullName || null);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelected(new Set());
  };

  // Removing links follows the plan: Freemium can't, Cloak Pro can change
  // a few per period (lib/watchedLinks.ts enforces it on the server).
  const changesLeft = linkFetch?.links.changesLeft ?? 0;
  const canRemoveLinks = changesLeft > 0;

  const toggleSelected = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else if (next.size >= changesLeft) {
        toast.error(
          `You can remove ${changesLeft} more link${changesLeft === 1 ? "" : "s"} right now.`,
          { id: "link-changes" },
        );
        return prev;
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (selected.size === 0 || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/fetch-urls", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: Array.from(selected) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Couldn't delete selected links.");
        return;
      }
      setLinks((prev) => prev.filter((link) => !selected.has(link.url)));
      setSelected(new Set());
      setSelectMode(false);
      toast.success("Removed from Cloak Watch");
      // Uses up changes — refresh what's left.
      void refreshLinkFetch();
    } catch {
      toast.error("Couldn't delete selected links.");
    } finally {
      setDeleting(false);
    }
  };

  // Add Link sheet: "add" from the button, "prompt" right after the user
  // dismissed every suggested link (offering their own links instead).
  const [addSheet, setAddSheet] = useState<"add" | "prompt" | null>(null);

  const scrape = linkFetch?.scrape;
  const scrapePercent =
    scrape && scrape.linkCount > 0 ? Math.round((scrape.finishedCount / scrape.linkCount) * 100) : 0;

  if (watchingPosts) {
    return (
      <ScrapingPostsScreen
        scrape={linkFetch?.scrape ?? null}
        onBack={() => {
          setWatchingPosts(false);
          setPostsDismissed(true);
        }}
        onRetry={() => void handleRetryScrape()}
        retrying={retryingScrape}
        onOk={() => {
          setWatchingPosts(false);
          setPostsDismissed(true);
          void reloadUrls();
        }}
      />
    );
  }

  if (watchingScrape) {
    return (
      <ScrapingLinksScreen
        status={linkFetch}
        onBack={() => {
          setWatchingScrape(false);
          setScrapeDismissed(true);
        }}
        onRetry={() => {
          setScrapeDismissed(false);
          void startLinkFetch();
        }}
        onOk={() => {
          setWatchingScrape(false);
          setScrapeDismissed(true);
          if (!linkFetch?.awaitingReview) toast("No new links found");
        }}
      />
    );
  }

  if (showConfirm && linkFetch) {
    return (
      <ConfirmLinksScreen
        urls={linkFetch.urls}
        subjectName={subjectName || ""}
        allowance={linkFetch.links}
        onBack={() => setReviewDismissed(true)}
        onDone={(next, { keptCount }) => {
          applyStatus(next);
          void reloadUrls();
          if (keptCount === 0) {
            // Dismissed them all — offer adding their own links instead.
            setAddSheet("prompt");
            return;
          }
          // Choosing starts scraping — show its loader next.
          setPostsDismissed(false);
          setWatchingPosts(true);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between bg-white z-10">
        <button type="button" onClick={() => router.back()} className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Cloak Watch</h1>
        {links.length > 0 && (canRemoveLinks || selectMode) ? (
          <button
            type="button"
            onClick={toggleSelectMode}
            className="pl-2 text-[14px] text-[#00C2CE]"
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
        ) : (
          <div className="-mr-3 w-10" />
        )}
      </header>

      <main className="-mx-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {stats && links.length > 0 && (
          <div className="mb-4 grid grid-cols-3 rounded-2xl bg-[#F5F5F5] py-3">
            {[
              { label: "Reports", value: stats.found },
              { label: "Verified", value: stats.confirmed },
              { label: "Accuracy", value: stats.accuracy != null ? `${stats.accuracy}%` : "—" },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center gap-1 ${index > 0 ? "border-l border-[#E2E2E2]" : ""}`}
              >
                <p className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">{stat.value}</p>
                <p className="text-[12px] leading-4 text-[#A7ADB2]">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {needsProfile && (
          <div className="mb-4 rounded-3xl border border-[#C8EEF1] bg-[#E7F9FB] p-3.5">
            <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">
              Complete Your Identity Profile
            </p>
            <p className="mt-0.5 text-[12px] leading-4 text-[#839297]">
              {describeMissingProfile(linkFetch.missingProfile)}
            </p>
            <Link
              href={profileCompletionHref(linkFetch.missingProfile)}
              className="mt-3 inline-flex h-[30px] items-center justify-center rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white"
            >
              Complete Profile
            </Link>
          </div>
        )}

        {showCheckLinks && (
          <div className="mb-4 rounded-3xl border border-[#C8EEF1] bg-[#E7F9FB] p-3.5">
            <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">
              Your links haven&apos;t been checked yet
            </p>
            <p className="mt-0.5 text-[12px] leading-4 text-[#839297]">
              {uncheckedCount} link{uncheckedCount === 1 ? "" : "s"} you added{" "}
              {uncheckedCount === 1 ? "is" : "are"} waiting to be checked for posts about you.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCheckLinks()}
                disabled={retryingScrape}
                className="inline-flex h-[30px] items-center justify-center gap-2 rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white disabled:opacity-60"
              >
                {retryingScrape && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                Check my links now
              </button>
              {canStartFirstScan && (
                <button
                  type="button"
                  onClick={() => void handleStartScan()}
                  disabled={startingScan || retryingScrape}
                  className="inline-flex h-[30px] items-center justify-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-[#00C3D0] disabled:opacity-60"
                >
                  {startingScan && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#00C3D0]/30 border-t-[#00C3D0]" />
                  )}
                  Find more links first
                </button>
              )}
            </div>
          </div>
        )}

        {canStartFirstScan && !showCheckLinks && (
          <div className="mb-4 rounded-3xl border border-[#C8EEF1] bg-[#E7F9FB] p-3.5">
            <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">
              {links.length > 0 ? "Find more links about you" : "Find links about you"}
            </p>
            <p className="mt-0.5 text-[12px] leading-4 text-[#839297]">
              Your identity profile is ready. Find accounts and pages that match you.
            </p>
            <button
              type="button"
              onClick={() => void handleStartScan()}
              disabled={startingScan}
              className="mt-3 inline-flex h-[30px] items-center justify-center gap-2 rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white disabled:opacity-60"
            >
              {startingScan && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              Find Links
            </button>
          </div>
        )}

        {linkFetch?.status === "running" && (
          <button
            type="button"
            onClick={() => setScrapeDismissed(false)}
            className="mb-4 block w-full rounded-3xl bg-[#E9FEFF] px-2.5 pb-3 pt-2 text-left"
          >
            <p className="px-0.5 text-[12px] leading-4 text-[#2B2B2B]">Finding links…</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#00C2CE]" />
            </div>
          </button>
        )}

        {scrapeState === "running" && (
          <button
            type="button"
            onClick={() => setPostsDismissed(false)}
            className="mb-4 block w-full rounded-[20px] bg-[#E9FEFF] px-3 pb-2.5 pt-3 text-left"
          >
            <p className="text-[14px] leading-5 text-[#2B2B2B]">Scraping is in Progress</p>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E3E3E3]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#14C3CF] to-[#2BD9E4] transition-[width] duration-500"
                style={{ width: `${Math.max(scrapePercent, 4)}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[11px] leading-4 text-[#14C3CF]">
              {scrapePercent}% Done
            </p>
          </button>
        )}

        {scrapeState === "failed" && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-3xl bg-[#FFF1F1] px-3 py-3">
            <span className="text-[12px] leading-4 text-[#2B2B2B]">
              {linkFetch?.scrape.error || "Scraping failed."}
            </span>
            <button
              type="button"
              onClick={() => void handleRetryScrape()}
              disabled={retryingScrape}
              className="flex shrink-0 items-center gap-1.5 text-[12px] text-[#F30131] disabled:opacity-60"
            >
              {retryingScrape && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#F30131]/30 border-t-[#F30131]" />
              )}
              {retryingScrape ? "Retrying..." : "Try again"}
            </button>
          </div>
        )}

        {linkFetch?.awaitingReview && (
          <button
            type="button"
            onClick={() => setReviewDismissed(false)}
            className="mb-4 flex w-full items-center justify-between rounded-3xl bg-[#E9FEFF] px-3 py-3 text-left"
          >
            <span className="text-[12px] leading-4 text-[#2B2B2B]">
              {linkFetch.urls.length} new link{linkFetch.urls.length === 1 ? "" : "s"} to review
            </span>
            <ChevronRight className="h-4 w-4 text-[#00C2CE]" />
          </button>
        )}

        {linkFetch?.status === "failed" && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-3xl bg-[#FFF1F1] px-3 py-3">
            <span className="text-[12px] leading-4 text-[#2B2B2B]">
              {linkFetch.error || "Link search failed."}
            </span>
            <button
              type="button"
              onClick={() => {
                setScrapeDismissed(false);
                void startLinkFetch();
              }}
              className="shrink-0 text-[12px] text-[#F30131]"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : links.length > 0 ? (
          <div className="-mx-4">
            {links.map((link) => {
              const isSelected = selected.has(link.url);
              const row = (
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                    selectMode && isSelected ? "bg-[#E9F9FB]" : ""
                  }`}
                >
                  {selectMode && (
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                        isSelected ? "border-[#00C2CE]" : "border-[#A7AAB1]"
                      }`}
                    >
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-[#00C2CE]" />}
                    </span>
                  )}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#839297]">
                    <PlatformGlyph platform={link.platform} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Full link — several watched links can share a domain. */}
                    <p className="break-all text-[14px] leading-5 text-[#2B2B2B]">
                      {getSourceLinkLabel(link.url)}
                    </p>
                    <p className="truncate text-[11px] leading-4 text-[#839297]">
                      {subjectName || ""}
                    </p>
                    {link.scrapeError && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#F30131]">
                        {link.scrapeError}
                      </p>
                    )}
                  </div>
                  <LinkProgress
                    link={link}
                    scrapeRunning={scrapeState === "running"}
                    postsFetched={linkFetch?.scrape.postsByLink[link.uuid] ?? 0}
                  />
                  <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#2B2B2B]" />
                </div>
              );

              return selectMode ? (
                <button
                  key={link.uuid}
                  type="button"
                  onClick={() => toggleSelected(link.url)}
                  className="block w-full text-left"
                >
                  {row}
                </button>
              ) : (
                <Link key={link.uuid} href={`/cloak-watch/${encodeURIComponent(link.url)}`} className="block">
                  {row}
                </Link>
              );
            })}
          </div>
        ) : needsProfile || canStartFirstScan || linkFetch?.status === "running" ? null : (
          // No watched links (e.g. every suggestion was dismissed) — keep
          // a way forward on screen.
          <div className="rounded-3xl border border-[#C8EEF1] bg-[#E7F9FB] p-3.5">
            <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">
              No links being monitored yet
            </p>
            <p className="mt-0.5 text-[12px] leading-4 text-[#839297]">
              Add your Instagram, Facebook or X profiles and Cloak will watch them for posts about you.
            </p>
            <button
              type="button"
              onClick={() => setAddSheet("add")}
              className="mt-3 inline-flex h-[30px] items-center justify-center rounded-full bg-[#00C3D0] px-4 text-[14px] font-medium text-white"
            >
              Add Link
            </button>
          </div>
        )}
      </main>

      {selectMode && (
        <div className="pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
          <p className="mb-2 text-center text-[11px] leading-4 text-[#839297]">
            You can remove {changesLeft} more link{changesLeft === 1 ? "" : "s"} in this{" "}
            {LINK_CHANGE_WINDOW_DAYS}-day period.
          </p>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={selected.size === 0 || deleting}
            className="h-12 w-full rounded-full bg-[#FFE5E5] text-[16px] text-[#F30131] disabled:opacity-50"
          >
            {deleting ? "Deleting..." : `Delete (${selected.size})`}
          </button>
        </div>
      )}

      {!selectMode && !needsProfile && links.length > 0 && (
        <div className="pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
          <button
            type="button"
            onClick={() => setAddSheet("add")}
            className="h-12 w-full rounded-full bg-[#14C3CF] text-[16px] text-white"
          >
            Add Link
          </button>
        </div>
      )}

      <AddLinkSheet
        open={addSheet !== null}
        onClose={() => setAddSheet(null)}
        title={addSheet === "prompt" ? "Add your own links?" : "Add Link"}
        intro={
          addSheet === "prompt"
            ? "No problem — if you have Instagram, Facebook or X profiles, add them and Cloak will watch them for you."
            : undefined
        }
        dismissLabel={addSheet === "prompt" ? "Maybe later" : undefined}
        limitText={
          linkFetch ? `${linkFetch.links.count} / ${linkFetch.links.limit} links on your plan` : undefined
        }
        onAdded={({ scrapeStarted }) => {
          setAddSheet(null);
          void reloadUrls();
          // If it started scraping right away, pick that up (shows the loader).
          if (scrapeStarted) setPostsDismissed(false);
          void refreshLinkFetch();
        }}
      />
    </div>
  );
}

// Right side of a link row: live scrape progress while a scrape runs, the
// number of posts still to review, or when it was last checked.
function LinkProgress({
  link,
  scrapeRunning,
  postsFetched,
}: {
  link: WatchedLinkSummary;
  scrapeRunning: boolean;
  // Posts saved for this link during the current run.
  postsFetched: number;
}) {
  if (scrapeRunning && (link.scrapeStatus === "in_progress" || link.scrapeStatus === "queued")) {
    const active = link.scrapeStatus === "in_progress";
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] leading-4 text-[#14C3CF]">
        <span
          className={`h-4 w-4 rounded-full border-2 ${
            active ? "animate-spin border-[#14C3CF]/25 border-t-[#14C3CF]" : "border-[#E3E3E3]"
          }`}
        />
        <span className={active ? "" : "text-[#A7ADB2]"}>{active ? "Scanning" : "Queued"}</span>
      </span>
    );
  }
  if (scrapeRunning && link.scrapeStatus === "complete") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] leading-4 text-[#14C3CF]">
        <span className="h-4 w-4 rounded-full border-2 border-[#14C3CF]" />
        <span>
          Completed
          <span className="block text-[10px] text-[#839297]">
            {postsFetched} post{postsFetched === 1 ? "" : "s"}
          </span>
        </span>
      </span>
    );
  }
  if (link.newPosts > 0) {
    return (
      <span
        aria-label={`${link.newPosts} new posts`}
        className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#14C3CF] px-1 text-[10px] text-white"
      >
        {link.newPosts}
      </span>
    );
  }
  if (link.scrapeStatus === "failed") {
    return (
      <span className="shrink-0 text-right text-[10px] leading-[14px] text-[#F30131]">
        Last Check Failed
        {link.scrapeUpdatedAt && (
          <>
            <br />
            {formatAgo(link.scrapeUpdatedAt)}
          </>
        )}
      </span>
    );
  }
  if (link.scrapeUpdatedAt) {
    return (
      <span className="shrink-0 text-right text-[10px] leading-[14px] text-[#839297]">
        Last Checked
        <br />
        {formatAgo(link.scrapeUpdatedAt)}
      </span>
    );
  }
  return null;
}
