"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ExternalLink, FileSearch } from "lucide-react";
import Image from "next/image";
import VerifiedBadge from "@/app/components/VerifiedBadge";

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

type ReportDetails = {
  _id: string;
  platform: string;
  sourceLink: string;
  notes?: string;
  status: string;
  aiConfidence: number;
  createdAt?: string;
  user?: ReportUser;
};

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

  return {
    label: "",
    className: "text-[#98A0A7]",
  };
}

function DecisionResultModal({
  open,
  status,
  reporter,
  onDone,
}: {
  open: boolean;
  status: ResultModalStatus;
  reporter: ReportUser | null;
  onDone: () => void;
}) {
  if (!open || !status) return null;

  const isApproved = status === "VERIFIED";
  const avatarUrl =
    reporter?.profileImage ||
    reporter?.image ||
    "/images/placeholder_avatar.png";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/20">
      <div className="w-full rounded-t-[30px] bg-white px-8 pb-8 pt-3">
        <div className="mx-auto h-2 w-16 rounded-full bg-[#DADADA]" />

        <div className="pt-8">
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

          <h3 className="mt-6 text-[28px] font-semibold leading-tight text-[#2D2D2D]">
            {isApproved ? "Report Verified" : "Report Not Verified"}
          </h3>

          {isApproved ? (
            <>
              <p className="mt-4 text-[18px] leading-8 text-[#8D979E]">
                +50 points have been rewarded to reporter
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="relative h-8 w-8 overflow-hidden rounded-full bg-slate-200">
                  <Image
                    src={avatarUrl}
                    alt={reporter?.username || "Reporter"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <p className="text-[20px] font-medium text-[#2D2D2D]">
                  {reporter?.username || "reporter"}
                </p>
                {reporter?.identityVerificationStatus === "APPROVED" && (
                  <VerifiedBadge className="h-7 w-7 text-[#17C2CE]" />
                )}
              </div>
              <p className="mt-6 max-w-[520px] text-[18px] leading-8 text-[#8D979E]">
                We&apos;re happy that platform is helping you stay protected
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-[18px] leading-8 text-[#8D979E]">
                This report was marked as a false positive
              </p>
              <p className="mt-1 max-w-[560px] text-[18px] leading-8 text-[#8D979E]">
                Keep contributing, every report improves the system
              </p>
            </>
          )}

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onDone}
              className="h-14 min-w-[230px] rounded-full bg-[#17C2CE] px-10 text-[18px] font-medium text-white"
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [resultModal, setResultModal] = useState<ResultModalStatus>(null);
  const [reportViewType, setReportViewType] = useState<"sent" | "received">(
    initialViewType,
  );
  const fetchedReportKeyRef = useRef<string | null>(null);
  const fetchedPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${id}:${initialViewType}`;
    if (fetchedReportKeyRef.current === key) return;
    fetchedReportKeyRef.current = key;

    const fetchReport = async () => {
      try {
        const fetchByType = async (type: "sent" | "received") => {
          const res = await fetch(`/api/reports?type=${type}`);
          const data = await res.json().catch(() => null);
          if (data?.success) {
            const found = data.reports.find((item: any) => item._id === id);
            if (found) {
              setReport(found);
              setReportViewType(type);
              return true;
            }
          }
          return false;
        };

        const foundInRequested = await fetchByType(initialViewType);
        if (!foundInRequested) {
          await fetchByType(initialViewType === "sent" ? "received" : "sent");
        }
      } catch (error) {
        console.error("Failed to fetch report:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchReport();
  }, [id, initialViewType]);

  useEffect(() => {
    if (!report?.sourceLink) {
      setPreview(null);
      return;
    }

    if (fetchedPreviewUrlRef.current === report.sourceLink) return;
    fetchedPreviewUrlRef.current = report.sourceLink;

    const fetchPreview = async () => {
      setPreviewLoading(true);
      try {
        const params = new URLSearchParams({ url: report.sourceLink });
        const response = await fetch(`/api/link-preview?${params.toString()}`);
        const data = await response.json().catch(() => null);
        setPreview(data?.success ? (data.preview ?? null) : null);
      } catch (error) {
        console.error("Failed to fetch preview:", error);
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    void fetchPreview();
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
        return "/images/social-media/insta.svg";
    }
  };

  const getAvatarUrl = (user?: ReportUser) =>
    user?.profileImage || user?.image || "/images/placeholder_avatar.png";

  const reportedBy = useMemo(() => report?.user || null, [report]);
  const detailUser = useMemo(() => report?.user || null, [report]);
  const personSectionTitle =
    reportViewType === "sent" ? "Target User" : "Reported By";

  const sourceLinkLabel = useMemo(() => {
    if (!report?.sourceLink) return "";
    try {
      const parsed = new URL(report.sourceLink);
      return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}${parsed.search}`;
    } catch {
      return report.sourceLink;
    }
  }, [report?.sourceLink]);

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
      <header className="flex items-center justify-between px-2 pt-1">
        <button
          onClick={() =>
            router.push(reportViewType === "sent" ? "/my-reports" : "/reports")
          }
          className="p-2"
        >
          <ChevronLeft className="h-6 w-6 text-[#98A0A7]" />
        </button>
        <h1 className="text-[17px] font-semibold text-[#2D2D2D]">
          Report Details
        </h1>
        <div className="min-w-[78px] pr-2 text-right">
          {statusMeta.label ? (
            <p className={`text-[15px] font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </p>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-5">
        <section>
          <p className="mb-3 text-[16px] font-medium text-[#2D2D2D]">
            {personSectionTitle}
          </p>
          <div className="flex items-center justify-between rounded-[22px] bg-[#F1F1F1] px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200">
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
                  <p className="truncate text-[15px] font-medium text-[#2D2D2D]">
                    {detailUser.username}
                  </p>
                  {detailUser.identityVerificationStatus === "APPROVED" && (
                    <VerifiedBadge className="h-[18px] w-[18px] shrink-0 text-[#14C3CF]" />
                  )}
                </div>
                <p className="truncate text-[14px] text-[#99A0A7]">
                  {detailUser.name?.trim() || detailUser.username}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[15px] font-medium text-[#14C3CF]">
                Level {detailUser.level ?? 1}
              </p>
              <p className="mt-1 text-[14px] text-[#99A0A7]">
                {formatTimeAgo(report.createdAt)}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <p className="mb-3 text-[16px] font-medium text-[#2D2D2D]">
            Source Link
          </p>
          <a
            href={report.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-[22px] bg-[#F1F1F1] px-4 py-4"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#14C3CF]">
              <Image
                src={getPlatformImage(report.platform)}
                alt={report.platform}
                width={16}
                height={16}
                className="object-contain brightness-0 invert"
                unoptimized
              />
            </div>
            <p className="min-w-0 flex-1 truncate text-[15px] text-[#2D2D2D]">
              {sourceLinkLabel}
            </p>
            <ExternalLink className="h-5 w-5 shrink-0 text-[#98A0A7]" />
          </a>
        </section>

        <section className="mt-6">
          <p className="mb-3 text-[16px] font-medium text-[#2D2D2D]">
            Additional Notes
          </p>
          <div className="rounded-[22px] bg-[#F1F1F1] px-4 py-4">
            <p className="text-[15px] text-[#2D2D2D]">
              {report.notes?.trim() || "No additional notes provided."}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <p className="mb-3 text-[16px] font-medium text-[#2D2D2D]">
            Link Preview
          </p>
          <div className="overflow-hidden rounded-[28px] bg-[#F1F1F1]">
            {previewLoading ? (
              <div className="flex h-[260px] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
              </div>
            ) : preview?.image ? (
              <div className="flex h-[260px] items-center justify-center bg-[#F1F1F1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.image}
                  alt={preview.title || "Link preview"}
                  className="h-full w-auto max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-[260px] flex-col items-center justify-center px-6 text-center">
                <FileSearch className="h-10 w-10 text-[#B0B5BB]" />
                <p className="mt-4 text-[16px] font-medium text-[#2D2D2D]">
                  {preview?.title || "Preview unavailable"}
                </p>
                <p className="mt-2 text-[14px] text-[#99A0A7]">
                  {preview?.domain || sourceLinkLabel}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[24px] bg-[#DFF4F6] px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-[#12BCC8]" />
              <p className="text-[16px] font-semibold text-[#2D2D2D]">
                AI Confidence Match
              </p>
            </div>
            <p className="text-[16px] font-semibold text-[#2D2D2D]">
              {report.aiConfidence}%
            </p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#D5D7D8]">
            <div
              className="h-full rounded-full bg-[#12C6D1]"
              style={{ width: `${report.aiConfidence}%` }}
            />
          </div>
        </section>

        {report.status === "PENDING" && reportViewType !== "sent" && (
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={() => void updateStatus("FALSE_POSITIVE")}
              disabled={updating}
              className="h-14 flex-1 rounded-full bg-[#ECECEC] px-4 text-[15px] font-medium text-[#9AA0A6] disabled:opacity-60"
            >
              Mark as False Positive
            </button>
            <button
              onClick={() => void updateStatus("VERIFIED")}
              disabled={updating}
              className="h-14 flex-1 rounded-full bg-[#16C1CD] px-4 text-[15px] font-medium text-white disabled:opacity-60"
            >
              {updating ? "Saving..." : "Verify Report"}
            </button>
          </div>
        )}
      </div>

      <DecisionResultModal
        open={Boolean(resultModal)}
        status={resultModal}
        reporter={reportedBy}
        onDone={() => setResultModal(null)}
      />
    </div>
  );
}
