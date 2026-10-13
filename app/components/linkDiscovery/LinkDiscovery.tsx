"use client";

import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { PlatformGlyph, getSourceLinkLabel } from "@/app/components/reports/reportUi";
import { detectPlatform } from "@/lib/platform";

// Link discovery runs as a background job on the server (see
// lib/fetchLinks.ts). These pieces let any screen show it: the identity
// profile flow that starts it, Cloak Watch, and the dashboard's Scan.

export type LinkFetchStatus = {
  status: "idle" | "running" | "done" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  awaitingReview: boolean;
  urls: string[];
  profileComplete: boolean;
  missingProfile: ProfileRequirement[];
  everFetched: boolean;
  // Post scraping on the links kept on Confirm Links.
  scrape: ScrapeStatus;
};

export type ScrapeStatus = {
  status: "idle" | "running" | "done" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  linkCount: number;
};

// Mirrors lib/fetchLinks.ts — the server decides what's missing.
export type ProfileRequirement = "fullName" | "usernames" | "keywords" | "referenceMedia";

const REQUIREMENT_LABELS: Record<ProfileRequirement, string> = {
  fullName: "full name",
  usernames: "usernames",
  keywords: "keywords",
  referenceMedia: "reference photos",
};

// "Add your keywords & reference photos so we know what to monitor for you."
export function describeMissingProfile(missing: ProfileRequirement[]): string {
  const labels = missing.map((item) => REQUIREMENT_LABELS[item]);
  const list =
    labels.length > 1
      ? `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`
      : labels[0] || "details";
  return `Add your ${list} so we know what to monitor for you.`;
}

// Straight to Reference Media when that's the only thing left.
export function profileCompletionHref(missing: ProfileRequirement[]): string {
  return missing.length === 1 && missing[0] === "referenceMedia"
    ? "/reference-media?mode=profile"
    : "/identity-profile";
}

const POLL_INTERVAL_MS = 3000;

// Tagged explicitly: a successful status has its own (null) `error`
// field, so checking for that key can't tell success from failure.
async function readStatus(
  res: Response,
): Promise<{ ok: true; status: LinkFetchStatus } | { ok: false; error: string }> {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    return { ok: false, error: data?.error || "Couldn't search for links. Please try again." };
  }
  return { ok: true, status: data as LinkFetchStatus };
}

// Loads the user's link-discovery job and keeps polling while it's running.
export function useLinkFetchStatus() {
  const [status, setStatus] = useState<LinkFetchStatus | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const result = await readStatus(await fetch("/api/fetch-urls", { cache: "no-store" }));
      if (mountedRef.current && result.ok) setStatus(result.status);
    } catch {
      // keep the last known status on a transient failure
    }
  }, []);

  // Starts a run (or attaches to the one already running). Resolves to
  // the error message if it couldn't be started.
  const start = useCallback(async (): Promise<string | null> => {
    setStartError(null);
    let error: string | null = null;
    try {
      const result = await readStatus(await fetch("/api/fetch-urls", { method: "POST" }));
      if (!result.ok) error = result.error;
      else if (mountedRef.current) setStatus(result.status);
    } catch {
      error = "Couldn't search for links. Please try again.";
    }
    if (error && mountedRef.current) setStartError(error);
    return error;
  }, []);

  // Re-runs the last scrape ("Try Again" on Scraping Posts).
  const retryScrape = useCallback(async (): Promise<string | null> => {
    let error: string | null = null;
    try {
      const result = await readStatus(await fetch("/api/scrape", { method: "POST" }));
      if (!result.ok) error = result.error;
      else if (mountedRef.current) setStatus(result.status);
    } catch {
      error = "Couldn't start scraping. Please try again.";
    }
    return error;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isRunning = status?.status === "running" || status?.scrape.status === "running";
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isRunning, refresh]);

  // For responses that already carry a fresh status (e.g. Confirm Links).
  const applyStatus = useCallback((next: LinkFetchStatus) => {
    if (mountedRef.current) setStatus(next);
  }, []);

  return { status, startError, refresh, start, retryScrape, applyStatus };
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Elapsed time is measured from the job's server-side start, so reopening
// the screen later still shows the real duration.
function useElapsedSeconds(startedAt: string | null, endedAt: string | null, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!startedAt) return 0;
  const end = endedAt && !running ? new Date(endedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
}

type ProgressState = "running" | "done" | "failed";

// Shared loader for both background jobs (finding links, scraping posts):
// spinning ring while running, Ok when done, Try Again on failure.
function ProgressScreen({
  state,
  startedAt,
  finishedAt,
  title,
  subtitle,
  rows,
  onBack,
  onOk,
  onRetry,
}: {
  state: ProgressState;
  startedAt: string | null;
  finishedAt: string | null;
  title: string;
  subtitle: string;
  rows: { label: string; value: string | number }[];
  onBack: () => void;
  onOk: () => void;
  onRetry: () => void;
}) {
  const running = state === "running";
  const failed = state === "failed";
  const elapsedSeconds = useElapsedSeconds(startedAt, finishedAt, running);
  const circumference = 2 * Math.PI * 44;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white px-4 pt-4 font-sf-pro-display">
      <header className="flex items-center">
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
      </header>

      <main className="mt-2 flex-1 min-h-0 overflow-y-auto">
        <div className="rounded-[32px] bg-gradient-to-b from-[#E6F8FA] to-white px-3 pb-4 pt-7">
          <div className="relative mx-auto flex h-[110px] w-[110px] items-center justify-center">
            <svg
              className={`absolute inset-0 h-full w-full -rotate-90 ${running ? "animate-spin" : ""}`}
              style={{ animationDuration: "2.5s" }}
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle cx="50" cy="50" r="44" fill="none" stroke="#ECECEC" strokeWidth="7" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={failed ? "#F30131" : "#14C3CF"}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={running ? circumference * 0.72 : 0}
                className="transition-[stroke-dashoffset] duration-500"
              />
            </svg>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#14C3CF] text-white">
              <PlatformGlyph platform="instagram" size={24} />
            </div>
          </div>

          <h2 className="mt-6 text-center text-[22px] font-medium leading-7 text-[#2B2B2B]">
            {title}
          </h2>
          <p className="mx-auto mt-2 max-w-[240px] text-center text-[11px] leading-4 text-[#839297]">
            {subtitle}
          </p>

          <div className="mt-8 rounded-[20px] border border-[#EDEDED] bg-white px-3 py-3">
            <p className="text-[14px] leading-5 text-[#2B2B2B]">Detection Information</p>
            {rows.map((row) => (
              <div
                key={row.label}
                className="mt-2.5 flex items-center justify-between text-[12px] leading-4"
              >
                <span className="text-[#839297]">{row.label}</span>
                <span className="text-[#2B2B2B]">{row.value}</span>
              </div>
            ))}
            <div className="mt-2.5 flex items-center justify-between text-[12px] leading-4">
              <span className="text-[#839297]">Time Elapsed</span>
              <span className="text-[#2B2B2B]">{formatElapsed(elapsedSeconds)}</span>
            </div>
          </div>
        </div>
      </main>

      <div className="pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <button
          type="button"
          onClick={failed ? onRetry : onOk}
          disabled={running}
          className="h-12 w-full rounded-full bg-[#14C3CF] text-[16px] text-white disabled:opacity-50"
        >
          {failed ? "Try Again" : "Ok"}
        </button>
      </div>
    </div>
  );
}

// Finding links (CV fetch-url) -> then Confirm Links.
export function ScrapingLinksScreen({
  status,
  error,
  onBack,
  onOk,
  onRetry,
}: {
  status: LinkFetchStatus | null;
  // A failure to even start the job (as opposed to the job failing).
  error?: string | null;
  // The job keeps running on the server after leaving this screen.
  onBack: () => void;
  onOk: () => void;
  onRetry: () => void;
}) {
  const state: ProgressState =
    error || status?.status === "failed" ? "failed" : status?.status === "done" ? "done" : "running";
  const foundCount = status?.urls.length ?? 0;

  return (
    <ProgressScreen
      state={state}
      startedAt={status?.startedAt ?? null}
      finishedAt={status?.finishedAt ?? null}
      title={state === "failed" ? "Scraping Failed" : state === "done" ? "Links Found" : "Scraping Links"}
      subtitle={
        state === "failed"
          ? error || status?.error || "Couldn't search for links. Please try again."
          : state === "done"
            ? foundCount > 0
              ? "Review the links we found and choose the ones to keep."
              : "We didn't find any new links this time."
            : "This may take a few minutes depending on the number of links."
      }
      rows={[{ label: "Pages Found", value: state === "done" ? foundCount : "—" }]}
      onBack={onBack}
      onOk={onOk}
      onRetry={onRetry}
    />
  );
}

// Scraping posts on the kept links (CV scraping/scrape), after Confirm Links.
export function ScrapingPostsScreen({
  scrape,
  error,
  onBack,
  onOk,
  onRetry,
}: {
  scrape: ScrapeStatus | null;
  error?: string | null;
  // Scraping keeps running on the server after leaving this screen.
  onBack: () => void;
  onOk: () => void;
  onRetry: () => void;
}) {
  const state: ProgressState =
    error || scrape?.status === "failed" ? "failed" : scrape?.status === "done" ? "done" : "running";

  return (
    <ProgressScreen
      state={state}
      startedAt={scrape?.startedAt ?? null}
      finishedAt={scrape?.finishedAt ?? null}
      title={state === "failed" ? "Scraping Failed" : state === "done" ? "Scraping Complete" : "Scraping Posts"}
      subtitle={
        state === "failed"
          ? error || scrape?.error || "Couldn't scrape your links. Please try again."
          : state === "done"
            ? "We've checked your links for posts that match you."
            : "Checking your links for posts that match you. This may take a few minutes."
      }
      rows={[{ label: "Links Being Scanned", value: scrape?.linkCount ?? "—" }]}
      onBack={onBack}
      onOk={onOk}
      onRetry={onRetry}
    />
  );
}

export function ConfirmLinksScreen({
  urls,
  subjectName,
  onBack,
  onDone,
}: {
  urls: string[];
  subjectName: string;
  // Leaving without choosing keeps the review open for later.
  onBack: () => void;
  // Gets the status after the review — scraping has started by then.
  onDone: (status: LinkFetchStatus) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const allSelected = urls.length > 0 && selected.size === urls.length;

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleChoose = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/fetch-urls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep: Array.from(selected) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Couldn't save your selection.");
        return;
      }
      toast.success("Links added to Cloak Watch");
      onDone(data as LinkFetchStatus);
    } catch {
      toast.error("Couldn't save your selection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white px-4 pt-4 font-sf-pro-display">
      <header className="flex items-center justify-between">
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Confirm Links</h1>
        <button
          type="button"
          onClick={() => setSelected(allSelected ? new Set() : new Set(urls))}
          className="min-w-10 text-right text-[12px] text-[#14C3CF]"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </header>
      <p className="mt-1 text-center text-[11px] leading-4 text-[#839297]">
        Select the links below that you want to keep
      </p>

      <main className="-mx-4 mt-4 flex-1 min-h-0 overflow-y-auto">
        {urls.map((url) => {
          const isSelected = selected.has(url);
          return (
            <div
              key={url}
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                isSelected ? "bg-[#E9F9FB]" : "bg-white"
              }`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => toggle(url)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    isSelected ? "border-[#14C3CF]" : "border-[#A7AAB1]"
                  }`}
                >
                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-[#14C3CF]" />}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#839297]">
                  <PlatformGlyph platform={detectPlatform(url)} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  {/* Full link — many results share a domain, so the path is
                      what tells them apart. */}
                  <span className="block break-all text-[14px] leading-5 text-[#2B2B2B]">
                    {getSourceLinkLabel(url)}
                  </span>
                  <span className="block truncate text-[11px] leading-4 text-[#839297]">
                    {subjectName}
                  </span>
                </span>
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${url}`}
                className="-mr-1 shrink-0 p-1"
              >
                <ArrowUpRight className="h-[18px] w-[18px] text-[#2B2B2B]" />
              </a>
            </div>
          );
        })}
      </main>

      <div className="pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <button
          type="button"
          onClick={() => void handleChoose()}
          disabled={selected.size === 0 || saving}
          className="h-12 w-full rounded-full bg-[#14C3CF] text-[16px] text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : `Choose (${selected.size})`}
        </button>
      </div>
    </div>
  );
}
