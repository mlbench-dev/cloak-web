"use client";

import { Check, ChevronLeft, X as XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IncidentStatusPill, PlatformIcon } from "../_components/IncidentUI";
import { detectPlatform } from "@/lib/platform";

const REJECTION_REASONS = [
  "Not me",
  "Incorrect context",
  "Poor image match",
  "Other",
] as const;

type ResultView = "detail" | "confirmed" | "reject-reason";
type IncidentStatus = "New" | "Confirmed" | "Rejected";

interface ScanResultsResponse {
  success: boolean;
  urls: string[];
  updatedAt: string | null;
}
interface LinkPreview {
  url: string;
  domain: string;
  title: string;
  description: string | null;
  image: string | null;
}

interface LinkPreviewResponse {
  success: boolean;
  preview: LinkPreview | null;
  reachable: boolean;
  statusCode: number | null;
  finalUrl: string | null;
}
function ResultHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between  bg-white z-10">
      {children}
      <div className="w-10" />
    </header>
  );
}

// Small helper so "Detected X ago" reads naturally instead of a raw ISO string.
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function IncidentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const url = decodeURIComponent(params.id);

  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [view, setView] = useState<ResultView>("detail");
  const [rejectionReason, setRejectionReason] = useState<string>(
    REJECTION_REASONS[0],
  );

  // Local-only for now — there's no per-url review field in `fetchUrl` yet,
  // so Confirm/Reject update this view's state but don't persist anywhere.
  // Once a review collection exists (e.g. urlReviews keyed by userId+url),
  // wire handleConfirm/handleReject to POST there instead of just setStatus.
  const [status, setStatus] = useState<IncidentStatus>("New");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scan-results")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ScanResultsResponse | null) => {
        if (cancelled) return;
        if (data?.success && data.urls.includes(url)) {
          setFound(true);
          setUpdatedAt(data.updatedAt);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewReachable, setPreviewReachable] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LinkPreviewResponse | null) => {
        if (cancelled || !data?.success) return;
        setPreview(data.preview);
        setPreviewReachable(data.reachable);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
      </div>
    );
  }

  if (!found) {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <ResultHeader>
          <button type="button" onClick={() => router.back()} className="p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-lg font-semibold text-[#2D2D2D]">
            Incident Details
          </h1>
        </ResultHeader>
        <div className="flex flex-1 items-center justify-center text-[14px] text-[#8F98A0]">
          Incident not found
        </div>
      </div>
    );
  }

  // --- Real fields, sourced from the fetchUrl document ---
  const platform = detectPlatform(url);
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  const urlLabel = url;
  const sourceUrl = url;
  const detectedAt = updatedAt ? new Date(updatedAt).toLocaleString() : "—";
  const detectedAgo = updatedAt ? timeAgo(new Date(updatedAt)) : "recently";
  const discoveryMethod = "Automated Web Scan"; // accurate today — this IS how it was found

  // --- Placeholder fields, pending CV service support ---
  // The scan currently only returns candidate URLs, not a verified match
  // score or evidence crop. Swap these for real values (and drop the
  // `matchPercent === null` / no-evidence branches below) once the
  // face-verification step writes them per-url.
  const matchPercent: number | null = null;
  // const evidenceImageUrl: string | null = null;

  const handleConfirm = () => {
    setStatus("Confirmed");
    setView("confirmed");
  };

  const handleReject = () => {
    setStatus("Rejected");
    setView("reject-reason");
  };

  if (view === "confirmed") {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <ResultHeader>
          <button
            type="button"
            onClick={() => router.push("/incidents")}
            className="p-2"
          >
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
        </ResultHeader>

        <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#E8FEFF]">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-[#14C3CF]">
              <Check className="h-10 w-10 text-[#14C3CF]" strokeWidth={3} />
            </div>
          </div>

          <h1 className="mt-6 text-center text-[24px] font-semibold text-[#2D2D2D]">
            Match Confirmed
          </h1>
          <p className="mx-auto mt-2 max-w-[280px] text-center text-[14px] leading-6 text-[#8F98A0]">
            This incident has been confirmed as a match to your identity.
          </p>

          <div className="mt-8 rounded-2xl border border-[#F0F0F0]">
            <div className="flex items-center gap-3 border-b border-[#F0F0F0] p-4">
              <PlatformIcon platform={platform} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-[#2D2D2D]">
                  {urlLabel}
                </p>
                <p className="mt-0.5 text-[13px] text-[#8F98A0]">
                  {matchPercent !== null
                    ? `${matchPercent}% match`
                    : "Match pending"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-[#F0F0F0] px-4 py-3.5">
              <div>
                <p className="text-[13px] text-[#8F98A0]">Detected</p>
                <p className="mt-0.5 text-[15px] font-semibold text-[#2D2D2D]">
                  {detectedAt}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-[13px] text-[#8F98A0]">Discovery Method</p>
                <p className="mt-0.5 text-[15px] font-semibold text-[#2D2D2D]">
                  {discoveryMethod}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-3">
            <Link
              href="/submit-report"
              className="flex h-14 w-full items-center justify-center rounded-full bg-[#14C3CF] text-[15px] font-medium text-white"
            >
              Start Reporting
            </Link>
            <button
              type="button"
              onClick={() => router.push("/incidents")}
              className="h-14 w-full rounded-full border-2 border-[#14C3CF] bg-white text-[15px] font-medium text-[#14C3CF]"
            >
              Done
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (view === "reject-reason") {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <ResultHeader>
          <button
            type="button"
            onClick={() => setView("detail")}
            className="p-2"
          >
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
        </ResultHeader>

        <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#FFEEEE]">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-[#EF4444]">
              <XIcon className="h-10 w-10 text-[#EF4444]" strokeWidth={3} />
            </div>
          </div>

          <h1 className="mt-6 text-center text-[24px] font-semibold text-[#2D2D2D]">
            Match Rejected
          </h1>
          <p className="mx-auto mt-2 max-w-[280px] text-center text-[14px] leading-6 text-[#8F98A0]">
            This incident has been marked as not related to your identity.
          </p>

          <div className="mt-8 rounded-2xl border border-[#F0F0F0]">
            <p className="px-4 pt-4 text-[15px] font-semibold text-[#2D2D2D]">
              Why are you rejecting this match?
            </p>
            <div className="mt-2">
              {REJECTION_REASONS.map((reason, index) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectionReason(reason)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${
                    index < REJECTION_REASONS.length - 1
                      ? "border-b border-[#F0F0F0]"
                      : ""
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      rejectionReason === reason
                        ? "border-[#14C3CF]"
                        : "border-[#D8D8D8]"
                    }`}
                  >
                    {rejectionReason === reason && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#14C3CF]" />
                    )}
                  </span>
                  <span className="text-[15px] text-[#2D2D2D]">{reason}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <button
              type="button"
              // TODO: once a review-persistence collection exists, send
              // { url, reason: rejectionReason } here before navigating away.
              onClick={() => router.push("/incidents")}
              className="h-14 w-full rounded-full bg-[#EF4444] text-[15px] font-medium text-white"
            >
              Confirm Rejection
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <ResultHeader>
        <button type="button" onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">
          Incident Details
        </h1>
      </ResultHeader>

      <main className="flex-1 min-h-0 overflow-y-auto py-4 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex items-center gap-3 pb-4">
          <PlatformIcon platform={platform} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-medium text-[#2D2D2D]">
              {platformLabel}
            </p>
            <p className="mt-0.5 text-[13px] text-[#8F98A0]">
              Detected {detectedAgo}
            </p>
          </div>
          <IncidentStatusPill status={status} />
        </div>
        <div className="border-t border-[#F0F0F0]" />

        <div className="mt-5 rounded-[20px] bg-[#E8FEFF] p-5">
          <p className="text-[13px] text-[#8F98A0]">Match Confidence</p>
          <p className="mt-1 text-[20px] font-semibold text-[#2D2D2D]">
            {matchPercent !== null ? `${matchPercent}% Match` : "Pending"}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#14C3CF]"
              style={{ width: `${matchPercent ?? 0}%` }}
            />
          </div>
        </div>

        <div className="mt-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#2D2D2D]">
              Source URL
            </p>
            <p className="mt-1 truncate text-[13px] text-[#8F98A0]">
              {urlLabel}
            </p>
          </div>
          <Link
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[13px] font-medium text-[#14C3CF]"
          >
            Open Source
          </Link>
        </div>

        <div className="mt-6">
          <p className="text-[15px] font-semibold text-[#2D2D2D]">Evidence</p>
          <div className="relative mt-3 h-56 w-full overflow-hidden rounded-2xl bg-gray-100">
            {previewLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
              </div>
            ) : preview?.image ? (
              <Image
                src={preview.image}
                alt={preview.title || "Evidence"}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[#8F98A0]">
                {previewReachable
                  ? "No preview image available for this link."
                  : "This link couldn't be reached — it may require login or have been taken down."}
              </div>
            )}
          </div>
          {preview?.title && (
            <div className="mt-3">
              <p className="truncate text-[14px] font-medium text-[#2D2D2D]">
                {preview.title}
              </p>
              {preview.description && (
                <p className="mt-0.5 line-clamp-2 text-[12px] text-[#8F98A0]">
                  {preview.description}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-[#F0F0F0] p-4">
          <p className="text-[15px] font-semibold text-[#2D2D2D]">
            Detection Information
          </p>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#8F98A0]">Detected</p>
            <p className="text-[13px] font-medium text-[#2D2D2D]">
              {detectedAt}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#8F98A0]">Discovery Method</p>
            <p className="text-[13px] font-medium text-[#2D2D2D]">
              {discoveryMethod}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#8F98A0]">Source</p>
            <p className="text-[13px] font-medium text-[#2D2D2D]">
              {platformLabel}
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            className="h-14 flex-1 rounded-full bg-[#14C3CF] text-[15px] font-medium text-white"
          >
            Confirm Match
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="h-14 flex-1 rounded-full bg-[#FDE8E8] text-[15px] font-medium text-[#D14343]"
          >
            Reject Match
          </button>
        </div>
      </main>
    </div>
  );
}
