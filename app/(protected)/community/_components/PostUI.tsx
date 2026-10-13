"use client";
import { CLOAK_WATCH_IMAGE_ASPECT } from "../_lib/posts";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertOctagon,
  Bookmark,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import toast from "react-hot-toast";
import type { CloakWatchPost } from "../_lib/posts";
import { formatTimeAgo } from "../_lib/posts";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import BottomSheet from "@/app/components/BottomSheet";

type ReportReason =
  | "Spam or Scams"
  | "Hate Speech"
  | "Harassment"
  | "Misleading Information"
  | "Other";

const reportReasons: ReportReason[] = [
  "Spam or Scams",
  "Hate Speech",
  "Harassment",
  "Misleading Information",
  "Other",
];
function useTapVsDrag(onTap: () => void) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    // Only treat it as a tap if the pointer barely moved —
    // anything more was a swipe through the carousel, not a click.
    if (dx < 10 && dy < 10) {
      onTap();
    }
  };

  return { onPointerDown, onPointerUp };
}
function ProgressiveImage({
  src,
  thumbSrc,
  alt,
}: {
  src: string;
  thumbSrc?: string;
  alt: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const img = new window.Image();
    img.src = src;
    if (img.complete) {
      setLoaded(true);
    } else {
      img.onload = () => setLoaded(true);
    }
  }, [src]);

  return (
    <div role="img" aria-label={alt} className="absolute inset-0">
      {thumbSrc && (
        <div
          className={`absolute inset-0 scale-105 blur-md transition-opacity duration-300 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
          style={{
            backgroundImage: `url("${thumbSrc}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        style={{
          backgroundImage: `url("${src}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </div>
  );
}
export function PostSharedSuccessToast(message: string) {
  toast.success(message, { duration: 1500 });
}

function OptionsSheet({
  open,
  onClose,
  onReport,
  isSaved,
  isOwner,
  onToggleSave,
  onCopyLink,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onReport: () => void;
  isSaved: boolean;
  isOwner: boolean;
  onToggleSave: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Options">
      <div className="px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="space-y-5 pt-5 text-[14px] leading-5 text-[#2B2B2B]">
          <button
            type="button"
            onClick={() => {
              onToggleSave();
              onClose();
            }}
            className="flex items-center gap-3"
          >
            <Bookmark
              className={`h-5 w-5 ${
                isSaved ? "fill-current text-[#01C3CF]" : "text-[#2B2B2B]"
              }`}
            />
            <span>{isSaved ? "Unsave Post" : "Save Post"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onCopyLink();
              onClose();
            }}
            className="flex items-center gap-3"
          >
            <Share2 className="h-5 w-5" />
            <span>Copy Post Link</span>
          </button>

          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="flex items-center gap-3 text-[#FC383A]"
            >
              <AlertOctagon className="h-5 w-5" />
              <span>Delete Post</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onReport}
              className="flex items-center gap-3 text-[#FC383A]"
            >
              <AlertOctagon className="h-5 w-5" />
              <span>Report</span>
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function ReportSheet({
  open,
  onClose,
  postId,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
}) {
  const [reason, setReason] = useState<ReportReason>("Spam or Scams");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Submit a Report"
      dismissible={!submitting}
      panelClassName="flex max-h-[60dvh] flex-col overflow-hidden"
      // Reset once the sheet has slid away, not while it's still visible.
      onExited={() => {
        setReason("Spam or Scams");
        setDetails("");
      }}
    >
      <div className="flex min-h-0 flex-col px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">

        <div className="space-y-3.5 overflow-y-auto pt-3.5 no-scrollbar">
          <div>
            <p className="text-[14px] leading-5 text-[#2B2B2B]">
              Select a Reason
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {reportReasons.map((item) => {
                const active = item === reason;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setReason(item)}
                    className={`h-[30px] rounded-full px-3 text-[14px] ${
                      active
                        ? "bg-[#01C3CF] text-white"
                        : "bg-[#F6F6F6] text-[#2B2B2B]"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[20px] bg-[#F6F6F6] px-3 py-2.5">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 200))}
              rows={4}
              placeholder="Provide additional details (required)..."
              className="block w-full resize-none bg-transparent text-base text-[#2B2B2B] outline-none placeholder:text-[14px] placeholder:text-[#839297]"
            />
            <div className="mt-1.5 flex justify-end text-[12px] text-[#839297]">
              {details.length}/200
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-[45px] w-[117px] shrink-0 rounded-full bg-[#F6F6F6] text-[14px] text-[#839297]"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!details.trim()) {
                  toast.error("Please provide additional details");
                  return;
                }

                try {
                  setSubmitting(true);
                  const response = await fetch(
                    `/api/community/posts/${postId}/report`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reason, details: details.trim() }),
                    },
                  );
                  const data = await response.json().catch(() => null);
                  if (!response.ok || !data?.success) {
                    throw new Error(data?.error || "Failed to submit report");
                  }
                  toast.success(
                    data.alreadyReported
                      ? "Report updated"
                      : "Report submitted",
                  );
                  onClose();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to submit report",
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
              className="h-[45px] flex-1 rounded-full bg-[#01C3CF] text-[14px] text-white disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

function DeleteConfirmationSheet({
  open,
  onClose,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Delete Post"
      dismissible={!deleting}
    >
      <div className="px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="pt-3.5">
          <p className="text-[14px] leading-5 text-[#839297]">
            Are you sure you want to delete this post? This action cannot be
            undone.
          </p>
          <div className="mt-5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="h-[45px] w-[117px] shrink-0 rounded-full bg-[#F6F6F6] text-[14px] text-[#839297] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="h-[45px] flex-1 rounded-full bg-[#FFEBEC] text-[14px] text-[#FC383A] disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete Post"}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

function CarouselDots({
  total,
  activeIndex,
}: {
  total: number;
  activeIndex: number;
}) {
  if (total <= 1) return null;

  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#00C3D0]/28 px-3 py-1.5">
      {Array.from({ length: total }).map((_, idx) => (
        <div
          key={idx}
          className={`h-2.5 w-2.5 rounded-full ${
            idx === activeIndex ? "bg-[#15C3CF]" : "bg-[#00C3D0]/40"
          }`}
        />
      ))}
    </div>
  );
}

export function PostCard({
  post,
  onOpenPost,
  onDeleted,
  onSaveStateChange,
  showShare = true,
}: {
  post: CloakWatchPost;
  onOpenPost?: (post: CloakWatchPost) => void;
  onDeleted?: (postId: string) => void;
  onSaveStateChange?: (post: CloakWatchPost, isSaved: boolean) => void;
  // The Saved Posts design has no share pill in the action row (copying
  // the link is still available from the ⋯ options sheet).
  showShare?: boolean;
}) {
  const { onPointerDown, onPointerUp } = useTapVsDrag(() =>
    onOpenPost?.(localPost),
  );
  const [localPost, setLocalPost] = useState(post);
  const [hidden, setHidden] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // A burst of clicks (up to hundreds under abuse) would otherwise fire one
  // network request each — this is what caused the intermittent vote/save
  // failures under rapid clicking. The UI still updates instantly on every
  // click; only the actual network call is coalesced to one request per
  // pause, carrying the final state.
  const VOTE_SAVE_DEBOUNCE_MS = 400;

  const voteConfirmedRef = useRef({
    up: post.up,
    down: post.down,
    viewerVote: post.viewerVote,
  });
  const pendingViewerVoteRef = useRef<1 | -1 | 0>(post.viewerVote);
  const voteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voteDispatchIdRef = useRef(0);
  // True from the moment a vote click is made until its request has settled
  // (applied or given up on) — guards the prop-sync effect below from
  // stomping an optimistic vote with stale server data (e.g. the parent
  // list re-fetching while the debounced request is still pending).
  const voteInFlightRef = useRef(false);

  const saveConfirmedRef = useRef({
    isSaved: post.isSaved,
    saves: post.saves,
  });
  const pendingIsSavedRef = useRef(post.isSaved);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDispatchIdRef = useRef(0);
  // Same purpose as voteInFlightRef, for the save toggle.
  const saveInFlightRef = useRef(false);

  const shareCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isShareCoolingDown, setIsShareCoolingDown] = useState(false);

  useEffect(() => {
    setHidden(false);
    setActiveImageIndex(0);

    // A fresh `post` prop (e.g. the parent list re-fetching) can arrive
    // while a vote/save request is still debouncing or in flight. That
    // prop reflects pre-click server state, so applying it wholesale would
    // silently revert the user's still-pending action. Keep our own
    // vote/save fields in that case; everything else in the prop is still
    // authoritative (images, deleted status, edited body, etc.).
    setLocalPost((prev) => ({
      ...post,
      ...(voteInFlightRef.current
        ? { up: prev.up, down: prev.down, viewerVote: prev.viewerVote }
        : null),
      ...(saveInFlightRef.current
        ? { isSaved: prev.isSaved, saves: prev.saves }
        : null),
    }));

    if (!voteInFlightRef.current) {
      voteConfirmedRef.current = {
        up: post.up,
        down: post.down,
        viewerVote: post.viewerVote,
      };
    }
    if (!saveInFlightRef.current) {
      saveConfirmedRef.current = { isSaved: post.isSaved, saves: post.saves };
    }
  }, [post]);

  const time = useMemo(
    () => formatTimeAgo(localPost.createdAt),
    [localPost.createdAt],
  );

  // Fires the actual vote request for whatever is currently in
  // pendingViewerVoteRef. Called either after the debounce settles, or
  // immediately on unmount (see the flush effect below) — a debounced
  // request that only clears the timer on unmount would silently drop the
  // action, e.g. unsaving a post removes its card from the Saved Posts
  // list, unmounting it before the timer ever fires.
  const sendVoteRequest = () => {
    const dispatchId = ++voteDispatchIdRef.current;
    const target = pendingViewerVoteRef.current;
    // Lets the server enforce "last click wins" even if this request's
    // response arrives out of order relative to a later one — see
    // app/api/community/posts/[id]/vote/route.ts.
    const clientSeq = Date.now();

    fetch(`/api/community/posts/${post.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: target, clientSeq }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Unable to update vote");
        }
        // A newer click has already queued another request since this one
        // was dispatched — ignore this response entirely rather than
        // letting an out-of-order reply overwrite the confirmed snapshot
        // with stale counts (the newer request's own response is what
        // should win).
        if (voteDispatchIdRef.current !== dispatchId) return;
        voteConfirmedRef.current = {
          up: data.up,
          down: data.down,
          viewerVote: data.viewerVote,
        };
        voteInFlightRef.current = false;
        setLocalPost((prev) => ({ ...prev, ...voteConfirmedRef.current }));
      })
      .catch((error) => {
        if (voteDispatchIdRef.current === dispatchId) {
          voteInFlightRef.current = false;
          setLocalPost((prev) => ({ ...prev, ...voteConfirmedRef.current }));
        }
        toast.error(
          error instanceof Error ? error.message : "Unable to update vote",
        );
      });
  };

  const sendSaveRequest = () => {
    const dispatchId = ++saveDispatchIdRef.current;
    const target = pendingIsSavedRef.current;
    const clientSeq = Date.now();

    fetch(`/api/community/posts/${post.id}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSaved: target, clientSeq }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Unable to save post");
        }
        // See sendVoteRequest above for why stale/out-of-order responses
        // are ignored rather than applied.
        if (saveDispatchIdRef.current !== dispatchId) return;
        saveConfirmedRef.current = { isSaved: data.isSaved, saves: data.saves };
        saveInFlightRef.current = false;
        setLocalPost((prev) => ({ ...prev, ...saveConfirmedRef.current }));
      })
      .catch((error) => {
        if (saveDispatchIdRef.current === dispatchId) {
          saveInFlightRef.current = false;
          setLocalPost((prev) => ({ ...prev, ...saveConfirmedRef.current }));
          onSaveStateChange?.(
            { ...post, ...saveConfirmedRef.current },
            saveConfirmedRef.current.isSaved,
          );
        }
        toast.error(
          error instanceof Error ? error.message : "Unable to save post",
        );
      });
  };

  useEffect(() => {
    return () => {
      if (voteTimerRef.current) {
        clearTimeout(voteTimerRef.current);
        sendVoteRequest();
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        sendSaveRequest();
      }
      if (shareCooldownTimerRef.current)
        clearTimeout(shareCooldownTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (hidden || localPost.isDeleted) {
    return null;
  }

  const handleVote = (value: 1 | -1) => {
    // 1. Optimistically update — mirrors the server's toggle logic exactly.
    // Computed synchronously from `localPost` (this render's latest state,
    // safe to read directly since nothing else updates it earlier in this
    // handler) rather than mutating an outer variable from inside the
    // setState updater — React doesn't guarantee that updater runs before
    // the next line, so reading it back immediately after was reading a
    // stale/default value more often than not.
    let { up, down, viewerVote } = localPost;

    if (viewerVote === value) {
      // clicking the same arrow again -> remove vote
      viewerVote = 0;
      if (value === 1) up -= 1;
      else down -= 1;
    } else if (viewerVote === 0) {
      // no prior vote -> add it
      viewerVote = value;
      if (value === 1) up += 1;
      else down += 1;
    } else {
      // switching from up->down or down->up
      viewerVote = value;
      if (value === 1) {
        up += 1;
        down -= 1;
      } else {
        down += 1;
        up -= 1;
      }
    }

    const nextViewerVote = viewerVote;
    setLocalPost((prev) => ({ ...prev, up, down, viewerVote: nextViewerVote }));

    pendingViewerVoteRef.current = nextViewerVote;
    voteInFlightRef.current = true;

    // 2. Debounce the actual network call — only the final state after the
    // click burst settles gets sent, as a single idempotent request.
    if (voteTimerRef.current) clearTimeout(voteTimerRef.current);
    voteTimerRef.current = setTimeout(sendVoteRequest, VOTE_SAVE_DEBOUNCE_MS);
  };

  const handleToggleSave = () => {
    // 1. Optimistically flip save state — computed synchronously from
    // `localPost` rather than inside the setState updater; see the same
    // note in handleVote above for why that matters.
    const nextIsSaved = !localPost.isSaved;
    const optimisticPost: CloakWatchPost = {
      ...localPost,
      isSaved: nextIsSaved,
      saves: localPost.saves + (nextIsSaved ? 1 : -1),
    };
    setLocalPost(optimisticPost);
    onSaveStateChange?.(optimisticPost, nextIsSaved);
    pendingIsSavedRef.current = nextIsSaved;
    saveInFlightRef.current = true;

    // 2. Debounce the actual network call — same reasoning as votes above.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(sendSaveRequest, VOTE_SAVE_DEBOUNCE_MS);
  };

  const handleCopyLink = async () => {
    if (isShareCoolingDown) return;
    setIsShareCoolingDown(true);
    shareCooldownTimerRef.current = setTimeout(
      () => setIsShareCoolingDown(false),
      2000,
    );

    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(
          `${window.location.origin}/community/post/${localPost.id}`,
        );
      }
      await fetch(`/api/community/posts/${localPost.id}/share`, {
        method: "POST",
      }).catch(() => null);
      toast.success("Post link has been copied", { duration: 1500 });
    } catch {
      toast.error("Unable to copy post link", { duration: 1500 });
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/community/posts/${localPost.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to delete post");
      }

      setHidden(true);
      setDeleteConfirmOpen(false);
      toast.success("Post deleted");
      onDeleted?.(localPost.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete post",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <article className="bg-white">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-full bg-slate-200">
              <Image
                src={localPost.avatarUrl || "/images/placeholder_avatar.png"}
                alt={localPost.username}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="truncate text-[14px] leading-5 text-[#2B2B2B]">
                  {localPost.username}
                </p>
                {localPost.identityVerificationStatus === "APPROVED" && (
                  <VerifiedBadge className="h-4 w-4 shrink-0 text-[#14C3CF]" />
                )}
              </div>
              <p className="text-[12px] leading-4 text-[#839297]">
                Level {localPost.level} • {time}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#839297]"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2.5 break-words text-[14px] leading-[18px] text-[#2B2B2B]">
          {localPost.body}
        </p>

        <div
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onOpenPost?.(localPost);
          }}
          className="relative mt-3.5 block w-full cursor-pointer overflow-hidden rounded-[20px] bg-[#EDE7DE] text-left"
        >
          <div
            ref={carouselRef}
            onScroll={() => {
              const el = carouselRef.current;
              if (!el) return;
              const width = el.clientWidth || 1;
              const idx = Math.round(el.scrollLeft / width);
              setActiveImageIndex(
                Math.max(0, Math.min(idx, localPost.images.length - 1)),
              );
            }}
            style={{
              touchAction: "pan-x pan-y",
              WebkitOverflowScrolling: "touch",
              overflowY: "hidden",
              // Without this, swiping past the first/last image doesn't stop
              // at the carousel's edge — the leftover swipe momentum chains
              // to the page itself, dragging the whole screen sideways into
              // empty space.
              overscrollBehaviorX: "contain",
            }}
            className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          >
            {(localPost.images ?? []).map((image, idx) => (
              <div
                key={`${localPost.id}-${idx}`}
                className="relative w-full shrink-0 snap-center"
                style={{ aspectRatio: CLOAK_WATCH_IMAGE_ASPECT }}
              >
                <ProgressiveImage
                  src={image.url}
                  thumbSrc={image.thumbUrl}
                  alt=""
                />
              </div>
            ))}
          </div>
          <CarouselDots
            total={localPost.images?.length ?? 0}
            activeIndex={activeImageIndex}
          />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Upvote Button */}
            <button
              type="button"
              onClick={() => void handleVote(1)}
              className={`inline-flex h-[34px] min-w-[51px] items-center justify-center gap-1.5 rounded-full px-2.5 text-[12px] ${
                localPost.viewerVote === 1
                  ? "bg-[#E6FEFF] text-[#01C3CF]"
                  : "bg-[#F6F6F6] text-[#2B2B2B]"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 14 15"
                fill="none"
                className="h-4.5 w-4.5 shrink-0"
                aria-hidden="true"
              >
                {localPost.viewerVote === 1 ? (
                  /* Solid Filled Arrow */
                  <path
                    d="M7.33522 0.267188C7.04947 -0.0890625 6.44947 -0.0890625 6.16372 0.267188L0.163724 7.76719C0.05 7.9 0 8.05 0 8.22C0 8.64 0.35 8.98594 0.749474 8.98594H3.74947V14.2359C3.74947 14.65 4.09947 14.9859 4.49947 14.9859H8.99947C9.39947 14.9859 9.74947 14.65 9.74947 14.2359V8.98594H12.7495C13.1495 8.98594 13.4995 8.64 13.4995 8.22C13.4995 8.05 13.4495 7.9 13.3352 7.76719L7.33522 0.267188Z"
                    fill="currentColor"
                  />
                ) : (
                  /* Your Original Outline Arrow */
                  <path
                    d="M7.33522 0.267188C7.04947 -0.0890625 6.44947 -0.0890625 6.16372 0.267188L0.163724 7.76719C0.0757027 7.8776 0.0206017 8.01059 0.00474773 8.1509C-0.0111063 8.2912 0.0129293 8.43314 0.0740946 8.5604C0.13526 8.68766 0.231075 8.7951 0.35054 8.87037C0.470004 8.94564 0.608274 8.9857 0.749474 8.98594H3.74947V14.2359C3.74947 14.4349 3.82849 14.6256 3.96914 14.7663C4.1098 14.9069 4.30056 14.9859 4.49947 14.9859H8.99947C9.19839 14.9859 9.38915 14.9069 9.5298 14.7663C9.67046 14.6256 9.74947 14.4349 9.74947 14.2359V8.98594H12.7495C12.8907 8.9857 13.0289 8.94564 13.1484 8.87037C13.2679 8.7951 13.3637 8.68766 13.4249 8.5604C13.486 8.43314 13.5101 8.2912 13.4942 8.1509C13.4783 8.01059 13.4232 7.8776 13.3352 7.76719L7.33522 0.267188ZM8.99947 7.48594H8.24947V13.4859H5.24947V7.48594H2.31022L6.74947 1.93669L11.1887 7.48594H8.99947Z"
                    fill="#2B2B2B"
                  />
                )}
              </svg>
              <span className="text-[#2B2B2B] tabular-nums">
                {localPost.up}
              </span>
            </button>

            {/* Downvote Button */}
            <button
              type="button"
              onClick={() => void handleVote(-1)}
              className={`inline-flex h-[34px] min-w-[51px] items-center justify-center gap-1.5 rounded-full px-2.5 text-[12px] ${
                localPost.viewerVote === -1
                  ? "bg-[#FFEBEC] text-[#D0383C]"
                  : "bg-[#F6F6F6] text-[#2B2B2B]"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 14 15"
                fill="none"
                className="h-4.5 w-4.5 shrink-0"
                aria-hidden="true"
              >
                {localPost.viewerVote === -1 ? (
                  /* Solid Filled Arrow */
                  <path
                    d="M6.1638 14.7191C6.44955 15.0754 7.04955 15.0754 7.3353 14.7191L13.3353 7.21914C13.45 7.1 13.5 6.95 13.5 6.78C13.5 6.36 13.15 6.00039 12.7495 6.00039H9.74955L9.74955 0.750389C9.74955 0.35 9.4 0.000389099 9.0 0.000389099H4.49955C4.1 0.000389099 3.74955 0.35 3.74955 0.750389L3.74955 6.00039H0.74955C0.35 6.00039 0 6.36 0 6.78C0 6.95 0.05 7.1 0.163799 7.21914L6.1638 14.7191Z"
                    fill="currentColor"
                  />
                ) : (
                  /* Your Original Outline Arrow */
                  <path
                    d="M6.1638 14.7191C6.44955 15.0754 7.04955 15.0754 7.3353 14.7191L13.3353 7.21914C13.4233 7.10873 13.4784 6.97574 13.4943 6.83543C13.5101 6.69513 13.4861 6.55319 13.4249 6.42593C13.3638 6.29866 13.2679 6.19123 13.1485 6.11596C13.029 6.04069 12.8907 6.00063 12.7495 6.00039H9.74955L9.74955 0.750389C9.74955 0.551476 9.67053 0.36071 9.52988 0.220058C9.38923 0.0794058 9.19846 0.000389099 8.99955 0.000389099H4.49955C4.30064 0.000389099 4.10987 0.0794058 3.96922 0.220058C3.82857 0.36071 3.74955 0.551476 3.74955 0.750389L3.74955 6.00039H0.74955C0.60835 6.00063 0.47008 6.04069 0.350616 6.11596C0.231152 6.19123 0.135336 6.29866 0.0741711 6.42593C0.0130062 6.55319 -0.0110302 6.69513 0.00482368 6.83543C0.0206785 6.97574 0.075779 7.10873 0.163799 7.21914L6.1638 14.7191ZM4.49955 7.50039H5.24955L5.24955 1.50039H8.24955V7.50039L11.1888 7.50039L6.74955 13.0496L2.3103 7.50039H4.49955Z"
                    fill="#2B2B2B"
                  />
                )}
              </svg>
              <span className="text-[#2B2B2B] tabular-nums">
                {localPost.down}
              </span>
            </button>

            {/* Share Button */}
            {showShare && (
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                disabled={isShareCoolingDown}
                className="flex h-[34px] w-10 items-center justify-center rounded-full bg-[#F6F6F6] text-[#2B2B2B] disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 15 14"
                  fill="none"
                  className="h-4.5 w-4.5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M14.7803 6.21959L8.78025 0.21959C8.67536 0.114733 8.54174 0.0433283 8.39627 0.0144026C8.25081 -0.0145231 8.10003 0.000329213 7.96301 0.0570817C7.82598 0.113834 7.70886 0.209939 7.62645 0.333246C7.54404 0.456554 7.50003 0.601527 7.5 0.74984V3.40859C5.45122 3.59818 3.54692 4.54549 2.15977 6.06511C0.772615 7.58474 0.0024538 9.56731 0 11.6248L0 12.7498C0.000118392 12.9055 0.0486823 13.0573 0.138956 13.1842C0.229229 13.311 0.356737 13.4066 0.503794 13.4577C0.650851 13.5088 0.810168 13.5129 0.959647 13.4694C1.10913 13.4259 1.24136 13.3369 1.338 13.2148C2.07288 12.3412 2.97446 11.6227 3.99007 11.1013C5.00569 10.5799 6.11501 10.2661 7.25325 10.1781C7.29075 10.1736 7.3845 10.1661 7.5 10.1586V12.7498C7.50003 12.8982 7.54404 13.0431 7.62645 13.1664C7.70886 13.2897 7.82598 13.3858 7.96301 13.4426C8.10003 13.4994 8.25081 13.5142 8.39627 13.4853C8.54174 13.4564 8.67536 13.3849 8.78025 13.2801L14.7803 7.28009C14.9209 7.13944 14.9998 6.94871 14.9998 6.74984C14.9998 6.55097 14.9209 6.36024 14.7803 6.21959ZM9 10.9393V9.37484C9 9.17593 8.92098 8.98516 8.78033 8.84451C8.63968 8.70386 8.44891 8.62484 8.25 8.62484C8.05875 8.62484 7.278 8.66234 7.0785 8.68859C5.0571 8.87463 3.13296 9.64262 1.539 10.8996C1.71993 9.24542 2.50465 7.7161 3.74292 6.60446C4.98118 5.49282 6.58596 4.87698 8.25 4.87484C8.44891 4.87484 8.63968 4.79582 8.78033 4.65517C8.92098 4.51452 9 4.32375 9 4.12484V2.56034L13.1895 6.74984L9 10.9393Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Bookmark Button — filled dark when saved, as in the design */}
          <button
            type="button"
            onClick={() => handleToggleSave()}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#F6F6F6] text-[#2B2B2B]"
          >
            <Bookmark
              className={`h-[18px] w-[18px] ${localPost.isSaved ? "fill-current" : ""}`}
              strokeWidth={1.8}
            />
          </button>
        </div>
      </article>

      <OptionsSheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        isSaved={localPost.isSaved}
        isOwner={localPost.isOwner}
        onToggleSave={() => handleToggleSave()}
        onCopyLink={() => void handleCopyLink()}
        onDelete={() => {
          setOptionsOpen(false);
          setDeleteConfirmOpen(true);
        }}
        onReport={() => {
          setOptionsOpen(false);
          setReportOpen(true);
        }}
      />

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        postId={localPost.id}
      />

      <DeleteConfirmationSheet
        open={deleteConfirmOpen}
        onClose={() => {
          if (!isDeleting) setDeleteConfirmOpen(false);
        }}
        onConfirm={() => void handleDelete()}
        deleting={isDeleting}
      />
    </>
  );
}
