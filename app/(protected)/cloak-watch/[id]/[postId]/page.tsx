"use client";

import { ChevronLeft, ChevronRight, Gauge } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IncidentStatusPill, PlatformGlyph, PlatformIcon } from "../../_components/IncidentUI";
import { getMockPostById, type PostStatus } from "../../_lib/mockPosts";
import { detectPlatform } from "@/lib/platform";

const REJECTION_REASONS = [
  "Not me",
  "Incorrect Context",
  "Poor image match",
  "Other",
] as const;

type ResultView = "detail" | "confirmed" | "reject-reason";

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
    <header className="flex items-center justify-between bg-white z-10">
      {children}
      <div className="-mr-3 w-10" />
    </header>
  );
}

// The 3D result icons from the reference design. The PNGs carry ~2px of
// transparent padding around the 115px artwork, hence 119px with a negative
// margin so the visible icon still sits exactly where the design has it.
function ResultIcon({ tone }: { tone: "success" | "error" }) {
  return (
    <Image
      src={
        tone === "success"
          ? "/images/incidents/match-confirmed.png"
          : "/images/incidents/match-rejected.png"
      }
      alt=""
      width={119}
      height={119}
      priority
      className="-my-0.5 mx-auto block"
    />
  );
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; postId: string }>();
  const linkUrl = decodeURIComponent(params.id);
  const post = getMockPostById(linkUrl, params.postId);

  const [view, setView] = useState<ResultView>("detail");
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_REASONS[0]);
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "New");

  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewReachable, setPreviewReachable] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewLoading = previewUrl !== linkUrl;
  // Scraped preview images can expire or refuse hotlinking after a
  // "successful" lookup — fall back to the no-image state instead of a
  // broken image.
  const [previewImageFailed, setPreviewImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(linkUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LinkPreviewResponse | null) => {
        if (cancelled || !data?.success) return;
        setPreview(data.preview);
        setPreviewReachable(data.reachable);
        setPreviewImageFailed(false);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setPreviewUrl(linkUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [linkUrl]);

  if (!post) {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <ResultHeader>
          <button type="button" onClick={() => router.back()} className="-ml-3 p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-[16px] font-medium text-[#2B2B2B]">Incident Details</h1>
        </ResultHeader>
        <div className="flex flex-1 items-center justify-center text-[12px] text-[#839297]">
          Post not found
        </div>
      </div>
    );
  }

  const platform = detectPlatform(linkUrl);
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  const backToPosts = `/cloak-watch/${params.id}`;

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
          <button type="button" onClick={() => router.push(backToPosts)} className="-ml-3 p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
        </ResultHeader>

        <main className="flex-1 min-h-0 overflow-y-auto mt-2 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="rounded-[32px] bg-gradient-to-b from-[#DDFEF5] to-white px-[15px] pb-[15px] pt-[38px]">
            <ResultIcon tone="success" />

            <h1 className="mt-10 text-center text-[24px] font-medium leading-[30px] text-[#0B1014]">
              Match Confirmed
            </h1>
            <p className="mx-auto mt-3 max-w-[250px] text-center text-[12px] leading-4 text-[#829194]">
              This incident has been confirmed as a match to your identity.
            </p>

            <div className="mt-[42px] rounded-3xl border border-[#F6F6F6] bg-white">
              <div className="flex items-center gap-3 p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F6F6F6]">
                  <PlatformGlyph platform={platform} size={24} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">
                    {platformLabel.toLowerCase()}.com/p/{post.id}...
                  </p>
                  <p className="mt-1 text-[12px] leading-4 text-[#839297]">
                    {post.matchPercent} % Attention Score
                  </p>
                </div>
              </div>
              <div className="mx-[13px] h-px bg-[#F6F6F6]" />
              <Link
                href={backToPosts}
                className="flex items-center justify-between px-[13px] pb-2 pt-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[12px] leading-4 text-[#839297]">Detected</p>
                  <p className="mt-1.5 truncate text-[14px] leading-5 text-[#2B2B2B]">
                    {post.detectedAt}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#9AB1B7]" />
              </Link>
              <div className="mx-[13px] h-px bg-[#F6F6F6]" />
              <Link
                href={backToPosts}
                className="flex items-center justify-between px-[13px] pb-2.5 pt-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[12px] leading-4 text-[#839297]">Discovery Method</p>
                  <p className="mt-1.5 truncate text-[14px] leading-5 text-[#2B2B2B]">
                    {post.discoveryMethod}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#9AB1B7]" />
              </Link>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/submit-report"
              className="flex h-[45px] w-full items-center justify-center rounded-full bg-[#00C2CE] text-[16px] font-medium text-white"
            >
              Start Reporting
            </Link>
            <button
              type="button"
              onClick={() => router.push(backToPosts)}
              className="h-[46px] w-full rounded-full border border-[#00C3D1] bg-white text-[16px] font-medium text-[#00C2CE]"
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
          <button type="button" onClick={() => setView("detail")} className="-ml-3 p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
        </ResultHeader>

        <main className="flex-1 min-h-0 overflow-y-auto mt-2 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="rounded-[32px] bg-gradient-to-b from-[#FFE3E5] to-white px-[14px] pb-3 pt-[38px]">
            <ResultIcon tone="error" />

            <h1 className="mt-10 text-center text-[24px] font-medium leading-[30px] text-[#0B1014]">
              Match Rejected
            </h1>
            <p className="mx-auto mt-3 max-w-[250px] text-center text-[12px] leading-4 text-[#829194]">
              This incident has been marked as not related to your identity.
            </p>

            <div className="mt-[88px] rounded-3xl border border-[#F6F6F6] bg-white p-3.5">
              <p className="text-[14px] leading-5 text-[#2B2B2B]">
                Why are you rejecting this match?
              </p>
              <div className="mt-3.5 grid grid-cols-2 gap-x-2.5 gap-y-3">
                {REJECTION_REASONS.map((reason) => {
                  const isActive = rejectionReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setRejectionReason(reason)}
                      className={`flex min-h-10 min-w-0 items-center gap-3 rounded-xl border px-2.5 py-2 text-left ${
                        isActive
                          ? "border-[#00C3CF] shadow-[0_0_0_2px_#D8F6F8]"
                          : "border-[#E7E7E7]"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                          isActive ? "border-[#00C3CF]" : "border-[#A7AAB1]"
                        }`}
                      >
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#00C3CF]" />}
                      </span>
                      <span className="min-w-0 break-words text-[12px] leading-4 text-[#2B2B2B]">{reason}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-20">
            <button
              type="button"
              onClick={() => router.push(backToPosts)}
              className="h-11 w-full rounded-full bg-[#FF383B] text-[16px] font-medium text-white"
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
        <button type="button" onClick={() => router.back()} className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Incident Details</h1>
      </ResultHeader>

      <main className="flex-1 min-h-0 overflow-y-auto pt-3.5 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">Evidence</p>
          <IncidentStatusPill status={status} />
        </div>

        <div className="relative mt-3.5 h-[227px] w-full overflow-hidden rounded-[20px] bg-gray-100">
          {previewLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
            </div>
          ) : preview?.image && !previewImageFailed ? (
            <Image
              src={preview.image}
              alt={preview.title || "Evidence"}
              fill
              className="object-cover"
              unoptimized
              referrerPolicy="no-referrer"
              onError={() => setPreviewImageFailed(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 pb-12 text-center">
              <PlatformIcon platform={platform} size="lg" />
              <p className="text-[12px] text-[#839297]">
                {previewReachable
                  ? "No preview image available for this link."
                  : "This link couldn't be reached — it may require login or have been taken down."}
              </p>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent pb-4 pl-2.5 pr-2 pt-8">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-white">
                <PlatformGlyph platform={platform} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] leading-[22px] text-white">{platformLabel}</p>
                <p className="truncate text-[14px] leading-5 text-white">Detected {post.timeLabel}</p>
              </div>
            </div>
            <Link
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[25px] shrink-0 items-center rounded-full bg-[#00C3CF] px-2 text-[14px] text-white"
            >
              Open Source
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">AI Analysis on post:</p>
          <p className="mt-2 text-[14px] leading-[21px] text-[#829194]">{post.aiAnalysis}</p>
        </div>

        <div className="mt-4 rounded-[20px] bg-[#E5F9FA] px-4 pb-4 pt-4">
          <p className="flex items-center gap-2.5 text-[14px] leading-6 text-[#829196]">
            <Gauge className="h-6 w-6 shrink-0 text-[#00C2CE]" />
            Match Confidence
          </p>
          <p className="mt-1 text-[16px] leading-[22px] text-[#2A2A28]">
            {post.matchPercent}% Attention Score
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#00C2CE]"
              style={{ width: `${post.matchPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-4 rounded-[20px] border border-[#E1E1E1] bg-white px-4 pb-3 pt-3.5">
          <p className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">Detection Information</p>
          <div className="mt-2.5 space-y-[9px]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] leading-5 text-[#829194]">Detected</p>
              <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">{post.detectedAt}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] leading-5 text-[#829194]">Discovery Method</p>
              <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">{post.discoveryMethod}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] leading-5 text-[#829194]">Source</p>
              <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">{platformLabel}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Pinned outside the scroll area so the decision is always visible */}
      <div className="flex shrink-0 items-center gap-2.5 bg-white pt-3">
        <button
          type="button"
          onClick={handleConfirm}
          className="h-11 flex-1 rounded-full bg-[#00C2CE] text-[16px] font-medium text-white"
        >
          Confirm Match
        </button>
        <button
          type="button"
          onClick={handleReject}
          className="h-11 flex-1 rounded-full bg-[#FFEBEC] text-[16px] font-medium text-[#FC383A]"
        >
          Reject Match
        </button>
      </div>
    </div>
  );
}
