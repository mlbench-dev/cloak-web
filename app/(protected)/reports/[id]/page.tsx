"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import Image from "next/image";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import { AiMatchIcon } from "@/public/svgIcons";

type ReportUser = {
  username: string;
  name?: string;
  image?: string;
  profileImage?: string;
  level?: number;
  identityVerificationStatus?: string;
};

type LinkPreview = {
  url: string;
  domain: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
};

type AiConfidenceStatus =
  | "pending"
  | "processing"
  | "awaiting_verification"
  | "completed"
  | "failed";

type ReportDetails = {
  _id: string;
  platform: string;
  sourceLink: string;
  notes?: string;
  status: string;
  aiConfidence: number;
  aiConfidenceMessage?: string;
  aiConfidenceSource?: "api" | "fallback";
  aiConfidenceStatus?: AiConfidenceStatus;
  createdAt?: string;
  user?: ReportUser;
  reportedByUser?: ReportUser;
};

// AI confidence isn't ready in any of these — either it's actively running,
// queued for a retry, or waiting on the target user's own verification.
// All three should keep showing a loader instead of a stale "0%".
function isAiConfidencePending(status?: AiConfidenceStatus) {
  return (
    status === "pending" ||
    status === "processing" ||
    status === "awaiting_verification" ||
    status === undefined
  );
}

// Same limit the submit-report form enforces on input.
const MAX_NOTES_LENGTH = 300;

type ResultModalStatus = "VERIFIED" | "FALSE_POSITIVE" | null;

function formatTimeAgo(value?: string) {
  if (!value) return "";

  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor((now - then) / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return `${Math.floor(diffMinutes / 1440)}d ago`;
}

function getStatusMeta(status: string) {
  if (status === "VERIFIED" || status === "APPROVED") {
    return {
      label: "Approved",
      className: "text-[#57C56F]",
    };
  }

  if (status === "FALSE_POSITIVE" || status === "REJECTED") {
    return {
      label: "Rejected",
      className: "text-[#FF6B6B]",
    };
  }
  if (status === "PENDING") {
    return {
      label: "Pending",
      className: "text-[#F59E0B]",
    };
  }
  return {
    label: "",
    className: "text-[#98A0A7]",
  };
}

function DecisionResultModal({
  open,
  status,
  reporter,
  pointsAwarded,
  onDone,
}: {
  open: boolean;
  status: ResultModalStatus;
  reporter: ReportUser | null;
  pointsAwarded: number;
  onDone: () => void;
}) {
  if (!open || !status) return null;

  const isApproved = status === "VERIFIED";
  const avatarUrl =
    reporter?.profileImage ||
    reporter?.image ||
    "/images/placeholder_avatar.png";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <div className="w-full rounded-t-[30px] bg-white px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2.5">
        <div className="mx-auto h-1 w-10 rounded-full bg-[#E0E0E0]" />

        <div className="pt-6">
          {isApproved ? (
            <svg
              width="34"
              height="40"
              viewBox="0 0 34 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17 0L30.8564 4.5V16.3037C30.8564 25.9355 24.917 34.584 17 38.5C9.08301 34.584 3.14355 25.9355 3.14355 16.3037V4.5L17 0Z"
                fill="#17C2CE"
              />
              <path
                d="M13.3799 19.7842L10.7842 17.1885L8.95508 19.0176L13.3799 23.4424L25.0449 11.7773L23.2158 9.94824L13.3799 19.7842Z"
                fill="white"
              />
            </svg>
          ) : (
            <svg
              width="34"
              height="34"
              viewBox="0 0 34 34"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="17" cy="17" r="17" fill="#17C2CE" />
              <circle cx="12.5" cy="13" r="1.5" fill="white" />
              <circle cx="21.5" cy="13" r="1.5" fill="white" />
              <path
                d="M10 23.5C12.1667 21.8333 14.5 21 17 21C19.5 21 21.8333 21.8333 24 23.5"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M12 7L23 5"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          )}

          <h3 className="mt-4 text-[24px] font-medium leading-[30px] text-[#2B2B2B]">
            {isApproved ? "Report Verified" : "Report Not Verified"}
          </h3>

          {isApproved ? (
            <>
              <p className="mt-2 text-[14px] leading-5 text-[#839297]">
                +{pointsAwarded} points have been awarded to reporter
              </p>
              <div className="mt-3.5 flex items-center gap-2">
                <div className="relative h-8 w-8 overflow-hidden rounded-full bg-slate-200">
                  <Image
                    src={avatarUrl}
                    alt={reporter?.username || "Reporter"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <p className="text-[16px] leading-[22px] text-[#2B2B2B]">
                  {reporter?.username || "reporter"}
                </p>
                {reporter?.identityVerificationStatus === "APPROVED" && (
                  <VerifiedBadge className="h-4 w-4 text-[#14C3CF]" />
                )}
              </div>
              <p className="mt-3.5 text-[14px] leading-5 text-[#839297]">
                We&apos;re happy that platform is helping you stay protected
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[14px] leading-5 text-[#839297]">
                This report was marked as a false positive
              </p>
              <p className="mt-1 text-[14px] leading-5 text-[#839297]">
                Keep contributing, every report improves the system
              </p>
            </>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={onDone}
              className="h-[45px] w-full rounded-full bg-[#01C3CF] text-[14px] text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialViewType =
    searchParams.get("type") === "sent" ? "sent" : "received";
  const [report, setReport] = useState<ReportDetails | null>(null);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewReachable, setPreviewReachable] = useState(false);
  // The source link the current preview state belongs to — until it matches
  // the report's link, the preview is still loading.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Scraped og:image URLs (Instagram/Facebook CDNs especially) often expire
  // or refuse hotlinking, so the <img> itself can fail after a "successful"
  // preview lookup.
  const [previewImageFailed, setPreviewImageFailed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [resultModal, setResultModal] = useState<ResultModalStatus>(null);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [reportViewType, setReportViewType] = useState<"sent" | "received">(
    initialViewType,
  );
  const fetchedReportKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${id}:${initialViewType}`;
    if (fetchedReportKeyRef.current === key) return;
    fetchedReportKeyRef.current = key;

    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/reports/${id}?type=${initialViewType}`);
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || !data?.report) {
          throw new Error(data?.error || "Failed to fetch report");
        }

        setReport(data.report);
        setReportViewType(data.viewType || initialViewType);
      } catch (error) {
        console.error("Failed to fetch report:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchReport();
  }, [id, initialViewType]);

  // AI confidence can take a while now (the underlying service gets up to
  // 10 minutes) and is computed server-side in the background — poll while
  // it's still pending/processing/awaiting verification so the loader
  // actually resolves into the real result on its own, instead of the user
  // having to manually refresh to find out it finished.
  useEffect(() => {
    if (!report || !isAiConfidencePending(report.aiConfidenceStatus)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/reports/${id}?type=${initialViewType}`);
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data?.report) {
          setReport(data.report);
        }
      } catch (error) {
        console.error("Failed to poll report status:", error);
      }
    }, 6000);

    return () => clearInterval(interval);
    // Deliberately keyed on the status string, not the whole `report`
    // object — every poll tick replaces `report` with a new reference, and
    // depending on it here would tear down and recreate the interval every
    // 6s for no reason instead of only when the status actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, initialViewType, report?.aiConfidenceStatus]);

  useEffect(() => {
    const sourceLink = report?.sourceLink;
    if (!sourceLink) return;

    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(sourceLink)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setPreview(data?.success ? (data.preview ?? null) : null);
        setPreviewReachable(Boolean(data?.success && data.reachable));
        setPreviewImageFailed(false);
      })
      .catch((error) => {
        console.error("Failed to fetch preview:", error);
      })
      .finally(() => {
        if (!cancelled) setPreviewUrl(sourceLink);
      });

    return () => {
      cancelled = true;
    };
  }, [report?.sourceLink]);

  const updateStatus = async (status: string) => {
    if (!report) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/reports/${report._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update report");
      }
      setReport((prev) => (prev ? { ...prev, status } : prev));
      setPointsAwarded(Number(data?.pointsAwarded) || 0);
      setResultModal(status as ResultModalStatus);
    } catch (error) {
      console.error("Failed to update report:", error);
    } finally {
      setUpdating(false);
    }
  };

  const getPlatformImage = (platform: string) => {
    switch (platform) {
      case "instagram":
        return "/images/social-media/insta.svg";
      case "twitter":
      case "x":
        return "/images/social-media/twitter.svg";
      case "facebook":
        return "/images/social-media/facebook.svg";
      case "tiktok":
        return "/images/social-media/tiktok.svg";
      default:
        return "/images/social-media/globe.svg";
    }
  };

  const getAvatarUrl = (user?: ReportUser) =>
    user?.profileImage || user?.image || "/images/placeholder_avatar.png";

  // const reportedBy = useMemo(() => report?.user || null, [report]);
  // const detailUser = useMemo(() => report?.user || null, [report]);
  const detailUser = useMemo(() => {
    if (!report) return null;
    return reportViewType === "sent" ? report.user : report.reportedByUser;
  }, [report, reportViewType]);

  const reportedBy = useMemo(() => report?.reportedByUser || null, [report]);
  const personSectionTitle =
    reportViewType === "sent" ? "Target User" : "Reported By";

  const sourceLinkLabel = report?.sourceLink
    ? (() => {
        try {
          const parsed = new URL(report.sourceLink);
          return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}${parsed.search}`;
        } catch {
          return report.sourceLink;
        }
      })()
    : "";
  const previewLoading =
    Boolean(report?.sourceLink) && previewUrl !== report?.sourceLink;
  const previewImage =
    !previewLoading && !previewImageFailed ? preview?.image : null;

  const statusMeta = getStatusMeta(report?.status || "");

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
      </div>
    );
  }

  if (!report || !detailUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center ">
        <p className="text-[#8F98A0]">Report not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 font-medium text-[#14C3CF]"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between  bg-white z-10">
        <button
          onClick={() =>
            router.push(reportViewType === "sent" ? "/my-reports" : "/reports")
          }
          className="-ml-3 p-2"
        >
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Report Details</h1>
        <div className="min-w-[78px] pr-2 text-right">
          {statusMeta.label ? (
            <p className={`text-[14px] font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </p>
          ) : (
            <div className="-mr-3 w-10" />
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-3.5">
        <section>
          <p className="mb-[5px] text-[14px] leading-5 text-[#2B2B2B]">
            {personSectionTitle}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[#F6F6F6] px-[13px] py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-full bg-slate-200">
                <Image
                  src={getAvatarUrl(detailUser)}
                  alt={detailUser.username}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[16px] leading-[22px] text-[#2B2B2B]">
                    {detailUser.username}
                  </p>
                  {detailUser.identityVerificationStatus === "APPROVED" && (
                    <VerifiedBadge className="h-4 w-4 shrink-0 text-[#14C3CF]" />
                  )}
                </div>
                <p className="mt-0.5 truncate text-[12px] leading-4 text-[#839297]">
                  {detailUser.name?.trim() || detailUser.username}
                </p>
              </div>
            </div>

            {/* Level + age only make sense for the reporter, not the target */}
            {reportViewType !== "sent" && (
              <div className="shrink-0 text-right">
                <p className="text-[12px] leading-4 text-[#01C3CF]">
                  Level {detailUser.level ?? 1}
                </p>
                <p className="mt-1.5 text-[12px] leading-4 text-[#839297]">
                  {formatTimeAgo(report.createdAt)}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-3.5">
          <p className="mb-[5px] text-[14px] leading-5 text-[#2B2B2B]">
            Source Link
          </p>
          <a
            href={report.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center gap-2 rounded-full bg-[#F6F6F6] pl-3.5 pr-2.5"
          >
            <Image
              src={getPlatformImage(report.platform)}
              alt={report.platform}
              width={18}
              height={18}
              className="shrink-0 object-contain"
            />
            <p className="min-w-0 flex-1 truncate text-[14px] leading-5 text-[#2B2B2B]">
              {sourceLinkLabel}
            </p>
            <ExternalLink
              className="h-[18px] w-[18px] shrink-0 text-[#839297]"
              strokeWidth={1.5}
            />
          </a>
        </section>

        <section className="mt-3.5">
          <p className="mb-[5px] text-[14px] leading-5 text-[#2B2B2B]">
            Additional Notes
          </p>
          {/* Grows with the text; notes are capped at MAX_NOTES_LENGTH */}
          <div className="rounded-[20px] bg-[#F6F6F6] px-3 py-2.5">
            <p className="text-[14px] leading-5 text-[#2B2B2B] break-words">
              {report.notes?.trim().slice(0, MAX_NOTES_LENGTH) ||
                "No additional notes provided."}
            </p>
          </div>
        </section>

        <section className="mt-6">
          <p className="mb-[5px] text-[14px] leading-5 text-[#2B2B2B]">
            Link Preview
          </p>
          <div className="overflow-hidden rounded-[20px] bg-[#F6F6F6]">
            {previewLoading ? (
              <div className="flex h-[206px] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
              </div>
            ) : previewImage ? (
              <div className="flex h-[206px] items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImage}
                  alt={preview?.title || "Link preview"}
                  referrerPolicy="no-referrer"
                  onError={() => setPreviewImageFailed(true)}
                  className="h-full w-auto max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-[206px] flex-col items-center justify-center gap-3 px-6 text-center">
                <Image
                  src={getPlatformImage(report.platform)}
                  alt={report.platform}
                  width={32}
                  height={32}
                  className="object-contain"
                />
                <p className="text-[12px] leading-4 text-[#839297]">
                  {previewReachable
                    ? "No preview image available for this link."
                    : "This link couldn't be reached — it may require login or have been taken down."}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Shown for both received reports and the user's own (sent) ones */}
        <section className="mt-[18px] rounded-[20px] bg-[#E6FEFF] px-2.5 pb-4 pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <AiMatchIcon className="h-[18px] w-[18px] shrink-0 text-[#01C3CF]" />
              <p className="truncate text-[14px] font-medium leading-5 text-[#2B2B2B]">
                AI Confidence Match
              </p>
            </div>
            {isAiConfidencePending(report.aiConfidenceStatus) ? (
              <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#01C3CF]/30 border-t-[#01C3CF]" />
            ) : (
              <p className="shrink-0 text-[14px] font-medium leading-5 text-[#2B2B2B]">
                {report.aiConfidence}%
              </p>
            )}
          </div>
          <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[#E0E0E0]">
            {isAiConfidencePending(report.aiConfidenceStatus) ? (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-[#01C3CF]/60" />
            ) : (
              <div
                className="h-full rounded-full bg-[#01C3CF]"
                style={{ width: `${report.aiConfidence}%` }}
              />
            )}
          </div>
          {report.aiConfidenceMessage ? (
            <p className="mt-2.5 text-[12px] leading-[18px] text-[#839297] break-words">
              {report.aiConfidenceMessage}
            </p>
          ) : null}
        </section>
      </div>

      {/* Pinned outside the scroll area so the decision is always visible */}
      {report.status === "PENDING" && reportViewType !== "sent" && (
        <div className="shrink-0 bg-white pt-3">
          <div className="flex items-center gap-[11px]">
            <button
              onClick={() => void updateStatus("FALSE_POSITIVE")}
              disabled={updating}
              className="h-[45px] flex-1 whitespace-nowrap rounded-full bg-[#F6F6F6] px-3 text-[14px] text-[#839297] transition-all active:scale-[0.98] disabled:opacity-60"
            >
              Mark as False Positive
            </button>
            <button
              onClick={() => void updateStatus("VERIFIED")}
              disabled={updating}
              className="h-[45px] flex-1 whitespace-nowrap rounded-full bg-[#01C3CF] px-3 text-[14px] text-white transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {updating ? "Saving..." : "Verify Report"}
            </button>
          </div>
        </div>
      )}

      <DecisionResultModal
        open={Boolean(resultModal)}
        status={resultModal}
        reporter={reportedBy}
        pointsAwarded={pointsAwarded}
        onDone={() => setResultModal(null)}
      />
    </div>
  );
}
