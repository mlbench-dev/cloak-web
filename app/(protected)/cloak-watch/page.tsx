"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PlatformIcon } from "./_components/IncidentUI";
import { detectPlatform } from "@/lib/platform";
import { getSourceLinkLabel } from "@/app/components/reports/reportUi";
import {
  ConfirmLinksScreen,
  ScrapingLinksScreen,
  ScrapingPostsScreen,
  describeMissingProfile,
  profileCompletionHref,
  useLinkFetchStatus,
} from "@/app/components/linkDiscovery/LinkDiscovery";

interface ScanResultsResponse {
  success: boolean;
  urls: string[];
}

interface IdentityProfileResponse {
  success: boolean;
  profile: { fullName?: string } | null;
}

async function fetchWatchedUrls(): Promise<string[] | null> {
  try {
    const res = await fetch("/api/scan-results", { cache: "no-store" });
    const data: ScanResultsResponse | null = res.ok ? await res.json() : null;
    return data?.success ? data.urls : null;
  } catch {
    return null;
  }
}

export default function IncidentsPage() {
  const router = useRouter();
  const [urls, setUrls] = useState<string[]>([]);
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
    applyStatus,
  } = useLinkFetchStatus();
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

  // Keeps what's shown if a reload fails.
  const reloadUrls = () =>
    fetchWatchedUrls().then((list) => {
      if (list) setUrls(list);
    });

  useEffect(() => {
    let cancelled = false;
    fetchWatchedUrls().then((list) => {
      if (cancelled) return;
      if (list) setUrls(list);
      setLoading(false);
    });
    void refreshLinkFetch();
    return () => {
      cancelled = true;
    };
  }, [refreshLinkFetch]);

  // New links land in the list as soon as a run finishes.
  const linkFetchState = linkFetch?.status;
  useEffect(() => {
    if (linkFetchState !== "done") return;
    let cancelled = false;
    fetchWatchedUrls().then((list) => {
      if (!cancelled && list) setUrls(list);
    });
    return () => {
      cancelled = true;
    };
  }, [linkFetchState]);

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

  const toggleSelected = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const allSelected = selected.size === urls.length && urls.length > 0;
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(urls));
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
      setUrls((prev) => prev.filter((url) => !selected.has(url)));
      setSelected(new Set());
      setSelectMode(false);
      toast.success("Removed from Cloak Watch");
    } catch {
      toast.error("Couldn't delete selected links.");
    } finally {
      setDeleting(false);
    }
  };

  if (watchingPosts) {
    return (
      <ScrapingPostsScreen
        scrape={linkFetch?.scrape ?? null}
        onBack={() => {
          setWatchingPosts(false);
          setPostsDismissed(true);
        }}
        onRetry={() => void retryScrape()}
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
        onBack={() => setReviewDismissed(true)}
        onDone={(next) => {
          // Choosing starts scraping — show its loader next.
          applyStatus(next);
          setPostsDismissed(false);
          setWatchingPosts(true);
          void reloadUrls();
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
        {urls.length > 0 ? (
          <button
            type="button"
            onClick={selectMode ? toggleSelectAll : toggleSelectMode}
            className="pl-2 text-[14px] text-[#00C2CE]"
          >
            {selectMode ? (allSelected ? "Deselect all" : "Select all") : "Select"}
          </button>
        ) : (
          <div className="-mr-3 w-10" />
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto pt-5 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
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

        {canStartFirstScan && (
          <div className="mb-4 rounded-3xl border border-[#C8EEF1] bg-[#E7F9FB] p-3.5">
            <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">
              Find links about you
            </p>
            <p className="mt-0.5 text-[12px] leading-4 text-[#839297]">
              Your identity profile is ready. Start a scan to find accounts and pages that match you.
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
              Start Scan
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
            className="mb-4 block w-full rounded-3xl bg-[#E9FEFF] px-2.5 pb-3 pt-2 text-left"
          >
            <p className="px-0.5 text-[12px] leading-4 text-[#2B2B2B]">Scraping posts…</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#00C2CE]" />
            </div>
          </button>
        )}

        {scrapeState === "failed" && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-3xl bg-[#FFF1F1] px-3 py-3">
            <span className="text-[12px] leading-4 text-[#2B2B2B]">
              {linkFetch?.scrape.error || "Scraping failed."}
            </span>
            <button
              type="button"
              onClick={() => {
                setPostsDismissed(false);
                void retryScrape();
              }}
              className="shrink-0 text-[12px] text-[#F30131]"
            >
              Try again
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
        ) : urls.length > 0 ? (
          <div className="space-y-3">
            {urls.map((url) => {
              const isSelected = selected.has(url);
              const row = (
                <div
                  className={`flex min-h-14 items-center gap-3 rounded-2xl bg-[#F6F6F6] px-2.5 py-2 ${
                    selectMode && isSelected
                      ? "ring-[1.5px] ring-[#00C2CE] shadow-[0_0_0_4px_rgba(0,194,206,0.12)]"
                      : ""
                  }`}
                >
                  {/* radio + icon sit closer together (9px) than the row's
                      12px gap, per the reference */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    {selectMode && (
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                          isSelected ? "border-[#00C2CE]" : "border-[#A7AAB1]"
                        }`}
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#00C2CE]" />
                        )}
                      </span>
                    )}
                    <PlatformIcon platform={detectPlatform(url)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Full link — several results share a domain, so the
                        path is what tells them apart. */}
                    <p className="break-all text-[14px] leading-5 text-[#2B2B2B]">
                      {getSourceLinkLabel(url)}
                    </p>
                    <p className="truncate text-[12px] leading-4 text-[#839297]">
                      {subjectName || "Pending review"}
                    </p>
                  </div>
                  <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#2B2B2B]" />
                </div>
              );

              return selectMode ? (
                <button
                  key={url}
                  type="button"
                  onClick={() => toggleSelected(url)}
                  className="block w-full text-left"
                >
                  {row}
                </button>
              ) : (
                <Link key={url} href={`/cloak-watch/${encodeURIComponent(url)}`} className="block">
                  {row}
                </Link>
              );
            })}
          </div>
        ) : needsProfile || canStartFirstScan ? null : (
          <p className="py-10 text-center text-[12px] text-[#839297]">
            No links detected yet
          </p>
        )}
      </main>

      {selectMode && (
        <div className="pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={selected.size === 0 || deleting}
            className="h-11 w-full rounded-full bg-[#FC383A] text-[16px] font-medium text-white disabled:opacity-50"
          >
            {deleting ? "Deleting..." : `Delete (${selected.size})`}
          </button>
        </div>
      )}
    </div>
  );
}
