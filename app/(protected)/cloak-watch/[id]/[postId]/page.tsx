"use client";

import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IncidentStatusPill, PlatformGlyph, PlatformIcon } from "../../_components/IncidentUI";
import { detectPlatform } from "@/lib/platform";
import type { CloakWatchPost, PostStatus } from "@/lib/cloakWatchPosts";
import toast from "react-hot-toast";
import { confirmAction } from "@/app/components/confirmAction";

function formatDetected(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function formatAgo(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
    <header className="flex items-center justify-between bg-white z-10">
      {children}
      <div className="-mr-3 w-10" />
    </header>
  );
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; postId: string }>();
  const linkUrl = decodeURIComponent(params.id);

  const [status, setStatus] = useState<PostStatus>("New");
  const [saving, setSaving] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(true);

  // The post, from the same per-link list (GET /api/cloak-watch/posts).
  const [post, setPost] = useState<CloakWatchPost | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cloak-watch/posts?link=${encodeURIComponent(linkUrl)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return;
        const found = (data.posts as CloakWatchPost[]).find((item) => item.id === params.postId);
        if (found) {
          setPost(found);
          setStatus(found.status);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoadingPost(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkUrl, params.postId]);

  // Evidence = the post's own preview, not the profile's.
  const postUrl = post?.url ?? null;
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewReachable, setPreviewReachable] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewLoading = previewUrl !== postUrl;
  // Scraped preview images can expire or refuse hotlinking after a
  // "successful" lookup — fall back to the no-image state instead of a
  // broken image.
  const [previewImageFailed, setPreviewImageFailed] = useState(false);

  useEffect(() => {
    if (!postUrl) return;
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(postUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LinkPreviewResponse | null) => {
        if (cancelled || !data?.success) return;
        setPreview(data.preview);
        setPreviewReachable(data.reachable);
        setPreviewImageFailed(false);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setPreviewUrl(postUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [postUrl]);

  if (loadingPost) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
      </div>
    );
  }

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

  const platform = detectPlatform(post.url);
  const platformLabel = platform === "twitter" ? "X" : capitalize(platform);

  // Saves the user's decision so the post moves to Confirmed/Rejected.
  const saveReview = async (next: Exclude<PostStatus, "New">) => {
    setSaving(true);
    try {
      const res = await fetch("/api/cloak-watch/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: linkUrl, postId: post.id, status: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Couldn't save your decision.");
        return false;
      }
      setStatus(next);
      return true;
    } catch {
      toast.error("Couldn't save your decision.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Both decisions are final (the buttons turn into "Confirmed/Rejected
  // Match"), so each asks first.
  const handleConfirm = async () => {
    const ok = await confirmAction({
      title: "Confirm this match?",
      text: "You're confirming this post shows you.",
      confirmText: "Confirm Match",
    });
    if (ok) await saveReview("Confirmed");
  };

  const handleReject = async () => {
    const ok = await confirmAction({
      title: "Reject this match?",
      text: "You're marking this post as not related to you.",
      confirmText: "Reject Match",
      tone: "danger",
    });
    if (ok) await saveReview("Rejected");
  };

  const analysis = [
    post.matchLevel ? `${capitalize(post.matchLevel)} with your identity.` : null,
    post.sentiment
      ? `Sentiment: ${post.sentiment}${post.sentimentPercent != null ? ` (${post.sentimentPercent}% confidence)` : ""}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

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

        {/* Tapping it opens the post itself. */}
        <Link
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-3 rounded-[20px] bg-[#F5F5F5] px-3 py-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14C3CF] text-white">
            <PlatformGlyph platform={platform} size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] leading-[22px] text-[#2B2B2B]">{platformLabel}</p>
            <p className="truncate text-[13px] leading-5 text-[#2B2B2B]">
              Detected {formatAgo(post.scrapedAt)}
            </p>
          </div>
          <div className="relative flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#E9ECEE]">
            {previewLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#14C3CF]/20 border-t-[#14C3CF]" />
            ) : preview?.image && !previewImageFailed ? (
              <Image
                src={preview.image}
                alt={preview.title || "Evidence"}
                fill
                sizes="56px"
                className="object-cover"
                unoptimized
                referrerPolicy="no-referrer"
                onError={() => setPreviewImageFailed(true)}
              />
            ) : (
              <PlatformIcon platform={platform} />
            )}
          </div>
        </Link>
        {!previewLoading && !previewReachable && (
          <p className="mt-1.5 text-[11px] leading-4 text-[#A7ADB2]">
            Preview unavailable — the post may need a login to view.
          </p>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setAnalysisOpen((open) => !open)}
            aria-expanded={analysisOpen}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
              AI Analysis on post:
            </span>
            {analysisOpen ? (
              <ChevronUp className="h-5 w-5 text-[#2B2B2B]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[#2B2B2B]" />
            )}
          </button>
          {analysisOpen &&
            (post.contentAnalysis ? (
              // The CV API's own write-up of the post.
              <p className="mt-2 whitespace-pre-line text-[14px] leading-[21px] text-[#829194]">
                {post.contentAnalysis}
              </p>
            ) : (
              // Older scrapes have no analysis text — show what we know:
              // match level, sentiment and the post's caption.
              <>
                {analysis && (
                  <p className="mt-2 text-[14px] leading-[21px] text-[#829194]">{analysis}</p>
                )}
                {post.content && (
                  <p className="mt-2 line-clamp-6 whitespace-pre-line text-[14px] leading-[21px] text-[#829194]">
                    {post.content}
                  </p>
                )}
              </>
            ))}
        </div>

        {/* The CV API's matchingscore (0–1). */}
        <div className="mt-4 rounded-[20px] bg-[#E5F9FA] px-4 pb-4 pt-4">
          <p className="text-[16px] leading-[22px] text-[#2A2A28]">
            {post.matchPercent != null
              ? `${post.matchPercent}% Match Score`
              : "Match Score unavailable"}
          </p>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E3E3E3]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#14C3CF] to-[#2BD9E4]"
              style={{ width: `${post.matchPercent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] leading-4 text-[#829194]">
            How closely faces here match your reference photos. Higher means more likely you.
          </p>
        </div>

        {/* The CV API's attentionscore (0–1). Older scrapes don't have one. */}
        <div className="mt-4 rounded-[20px] bg-[#E5F9FA] px-4 pb-4 pt-4">
          <p className="text-[16px] leading-[22px] text-[#2A2A28]">
            {post.attentionPercent != null
              ? `${post.attentionPercent}% Attention Score`
              : "Attention Score unavailable"}
          </p>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E3E3E3]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#14C3CF] to-[#2BD9E4]"
              style={{ width: `${post.attentionPercent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] leading-4 text-[#829194]">
            How much this post may need your attention. Highest when it&apos;s negative about you.
          </p>
        </div>

        <div className="mt-4 rounded-[20px] border border-[#E1E1E1] bg-white px-4 pb-3 pt-3.5">
          <p className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">Detection Information</p>
          <div className="mt-2.5 space-y-[9px]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] leading-5 text-[#829194]">Detected</p>
              <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">{formatDetected(post.scrapedAt)}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] leading-5 text-[#829194]">Posted</p>
              <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">{formatDetected(post.publishedAt)}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] leading-5 text-[#829194]">Discovery Method</p>
              <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">AI scan</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] leading-5 text-[#829194]">Source</p>
              <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">{platformLabel}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Pinned outside the scroll area so the decision is always visible */}
      {status !== "New" ? (
        <div className="shrink-0 bg-white pt-3">
          <button
            type="button"
            disabled
            className="h-11 w-full rounded-full bg-[#9AA3A8] text-[16px] text-white"
          >
            {status === "Confirmed" ? "Confirmed Match" : "Rejected Match"}
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2.5 bg-white pt-3">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving}
            className="h-11 flex-1 rounded-full bg-[#00C2CE] text-[16px] font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Confirm Match"}
          </button>
          <button
            type="button"
            onClick={() => void handleReject()}
            disabled={saving}
            className="h-11 flex-1 rounded-full bg-[#FFEBEC] text-[16px] font-medium text-[#FC383A] disabled:opacity-60"
          >
            Reject Match
          </button>
        </div>
      )}
    </div>
  );
}
