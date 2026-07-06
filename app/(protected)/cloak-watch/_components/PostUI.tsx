"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertOctagon,
  Bookmark,
  Check,
  MoreHorizontal,
  Share2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import type { CloakWatchPost } from "../_lib/posts";
import { formatTimeAgo } from "../_lib/posts";

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

function UpvoteIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 15"
      fill="none"
      className={`h-4.5 w-4.5 shrink-0 ${active ? "fill-current" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M7.33522 0.267188C7.04947 -0.0890625 6.44947 -0.0890625 6.16372 0.267188L0.163724 7.76719C0.0757027 7.8776 0.0206017 8.01059 0.00474773 8.1509C-0.0111063 8.2912 0.0129293 8.43314 0.0740946 8.5604C0.13526 8.68766 0.231075 8.7951 0.35054 8.87037C0.470004 8.94564 0.608274 8.9857 0.749474 8.98594H3.74947V14.2359C3.74947 14.4349 3.82849 14.6256 3.96914 14.7663C4.1098 14.9069 4.30056 14.9859 4.49947 14.9859H8.99947C9.19839 14.9859 9.38915 14.9069 9.5298 14.7663C9.67046 14.6256 9.74947 14.4349 9.74947 14.2359V8.98594H12.7495C12.8907 8.9857 13.0289 8.94564 13.1484 8.87037C13.2679 8.7951 13.3637 8.68766 13.4249 8.5604C13.486 8.43314 13.5101 8.2912 13.4942 8.1509C13.4783 8.01059 13.4232 7.8776 13.3352 7.76719L7.33522 0.267188ZM8.99947 7.48594H8.24947V13.4859H5.24947V7.48594H2.31022L6.74947 1.93669L11.1887 7.48594H8.99947Z"
        fill={active ? "currentColor" : "#2B2B2B"}
      />
    </svg>
  );
}

function DownvoteIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 15"
      fill="none"
      className={`h-4.5 w-4.5 shrink-0 ${active ? "fill-current" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M6.1638 14.7191C6.44955 15.0754 7.04955 15.0754 7.3353 14.7191L13.3353 7.21914C13.4233 7.10873 13.4784 6.97574 13.4943 6.83543C13.5101 6.69513 13.4861 6.55319 13.4249 6.42593C13.3638 6.29866 13.2679 6.19123 13.1485 6.11596C13.029 6.04069 12.8907 6.00063 12.7495 6.00039H9.74955L9.74955 0.750389C9.74955 0.551476 9.67053 0.36071 9.52988 0.220058C9.38923 0.0794058 9.19846 0.000389099 8.99955 0.000389099H4.49955C4.30064 0.000389099 4.10987 0.0794058 3.96922 0.220058C3.82857 0.36071 3.74955 0.551476 3.74955 0.750389L3.74955 6.00039H0.74955C0.60835 6.00063 0.47008 6.04069 0.350616 6.11596C0.231152 6.19123 0.135336 6.29866 0.0741711 6.42593C0.0130062 6.55319 -0.0110302 6.69513 0.00482368 6.83543C0.0206785 6.97574 0.075779 7.10873 0.163799 7.21914L6.1638 14.7191ZM4.49955 7.50039H5.24955L5.24955 1.50039H8.24955V7.50039L11.1888 7.50039L6.74955 13.0496L2.3103 7.50039H4.49955Z"
        fill={active ? "currentColor" : "#2B2B2B"}
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 15 14"
      fill="none"
      className="h-4.5 w-4.5 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M14.7803 6.21959L8.78025 0.21959C8.67536 0.114733 8.54174 0.0433283 8.39627 0.0144026C8.25081 -0.0145231 8.10003 0.000329213 7.96301 0.0570817C7.82598 0.113834 7.70886 0.209939 7.62645 0.333246C7.54404 0.456554 7.50003 0.601527 7.5 0.74984V3.40859C5.45122 3.59818 3.54692 4.54549 2.15977 6.06511C0.772615 7.58474 0.0024538 9.56731 0 11.6248L0 12.7498C0.000118392 12.9055 0.0486823 13.0573 0.138956 13.1842C0.229229 13.311 0.356737 13.4066 0.503794 13.4577C0.650851 13.5088 0.810168 13.5129 0.959647 13.4694C1.10913 13.4259 1.24136 13.3369 1.338 13.2148C2.07288 12.3412 2.97446 11.6227 3.99007 11.1013C5.00569 10.5799 6.11501 10.2661 7.25325 10.1781C7.29075 10.1736 7.3845 10.1661 7.5 10.1586V12.7498C7.50003 12.8982 7.54404 13.0431 7.62645 13.1664C7.70886 13.2897 7.82598 13.3858 7.96301 13.4426C8.10003 13.4994 8.25081 13.5142 8.39627 13.4853C8.54174 13.4564 8.67536 13.3849 8.78025 13.2801L14.7803 7.28009C14.9209 7.13944 14.9998 6.94871 14.9998 6.74984C14.9998 6.55097 14.9209 6.36024 14.7803 6.21959ZM9 10.9393V9.37484C9 9.17593 8.92098 8.98516 8.78033 8.84451C8.63968 8.70386 8.44891 8.62484 8.25 8.62484C8.05875 8.62484 7.278 8.66234 7.0785 8.68859C5.0571 8.87463 3.13296 9.64262 1.539 10.8996C1.71993 9.24542 2.50465 7.7161 3.74292 6.60446C4.98118 5.49282 6.58596 4.87698 8.25 4.87484C8.44891 4.87484 8.63968 4.79582 8.78033 4.65517C8.92098 4.51452 9 4.32375 9 4.12484V2.56034L13.1895 6.74984L9 10.9393Z"
        fill="#2B2B2B"
      />
    </svg>
  );
}

export function PostSharedSuccessToast(message: string) {
  toast.custom(
    () => (
      <div className="flex min-w-[320px] items-center gap-4 rounded-[24px] bg-white px-7 py-6 text-[#2D2D2D] shadow-[0_12px_35px_rgba(0,0,0,0.12)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full">
          <Check className="h-7 w-7 text-[#15C3CF]" strokeWidth={2.7} />
        </div>
        <span className="text-[16px] font-medium">{message}</span>
      </div>
    ),
    { duration: 2200 },
  );
}

function BottomSheet({
  open,
  onClose,
  children,
  panelClassName = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/20"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-t-[30px] bg-white pt-2 ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-2 w-16 rounded-full bg-[#DADADA]" />
        {children}
      </div>
    </div>
  );
}

function SheetHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="relative">
        <h3 className="text-center text-[18px] font-semibold text-[#2D2D2D]">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-1 right-0 flex h-9 w-9 items-center justify-center rounded-full text-[#98A0A7]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-6 border-t border-[#E8E8E8]" />
    </>
  );
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
    <BottomSheet open={open} onClose={onClose}>
      <div className="mt-6 px-7 pb-10 pt-2">
        <SheetHeader title="Options" onClose={onClose} />
        <div className="space-y-8 pt-8 text-[18px] text-[#2D2D2D]">
          <button
            type="button"
            onClick={() => {
              onToggleSave();
              onClose();
            }}
            className="flex items-center gap-4"
          >
            <Bookmark
              className={`h-6 w-6 ${
                isSaved ? "fill-current text-[#00C3D0]" : "text-[#2D2D2D]"
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
            className="flex items-center gap-4"
          >
            <Share2 className="h-6 w-6" />
            <span>Copy Post Link</span>
          </button>

          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="flex items-center gap-4 text-[#A31616]"
            >
              <AlertOctagon className="h-6 w-6" />
              <span>Delete Post</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onReport}
              className="flex items-center gap-4 text-[#A31616]"
            >
              <AlertOctagon className="h-6 w-6" />
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

  useEffect(() => {
    if (!open) {
      setReason("Spam or Scams");
      setDetails("");
    }
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      panelClassName="max-h-[60dvh] overflow-hidden"
    >
      <div className="mt-6 flex max-h-[calc(60dvh-1.5rem)] flex-col px-7 pb-10 pt-2">
        <SheetHeader title="Submit a Report" onClose={onClose} />

        <div className="space-y-7 overflow-y-auto pt-8 pr-1 no-scrollbar">
          <div>
            <p className="text-[17px] font-medium text-[#2D2D2D]">
              Select a Reason
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {reportReasons.map((item) => {
                const active = item === reason;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setReason(item)}
                    className={`rounded-full px-5 py-3 text-[15px] font-medium ${
                      active
                        ? "bg-[#15C3CF] text-white"
                        : "bg-[#F3F3F3] text-[#2D2D2D]"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] bg-[#F3F3F3] px-6 py-5">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 200))}
              rows={5}
              placeholder="Provide additional details (required)..."
              className="w-full resize-none bg-transparent text-[16px] text-[#2D2D2D] outline-none placeholder:text-[#98A0A7]"
            />
            <div className="mt-4 flex justify-end text-[14px] text-[#98A0A7]">
              {details.length}/200
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              className="h-14 min-w-[132px] rounded-full bg-[#F3F3F3] px-8 text-[16px] font-medium text-[#98A0A7]"
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
                    `/api/cloak-watch/posts/${postId}/report`,
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
              className="h-14 flex-1 rounded-full bg-[#15C3CF] px-8 text-[16px] font-medium text-white"
            >
              {submitting ? "Submitting..." : "Submit Report"}
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
}: {
  post: CloakWatchPost;
  onOpenPost?: (post: CloakWatchPost) => void;
  onDeleted?: (postId: string) => void;
}) {
  const [localPost, setLocalPost] = useState(post);
  const [hidden, setHidden] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalPost(post);
    setHidden(false);
    setActiveImageIndex(0);
  }, [post]);

  const time = useMemo(
    () => formatTimeAgo(localPost.createdAt),
    [localPost.createdAt],
  );

  if (hidden || localPost.isDeleted) {
    return null;
  }

  const handleVote = async (value: 1 | -1) => {
    try {
      const response = await fetch(
        `/api/cloak-watch/posts/${localPost.id}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to update vote");
      }

      setLocalPost((prev) => ({
        ...prev,
        up: data.up,
        down: data.down,
        viewerVote: data.viewerVote,
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update vote",
      );
    }
  };

  const handleToggleSave = async () => {
    try {
      const response = await fetch(
        `/api/cloak-watch/posts/${localPost.id}/save`,
        {
          method: "POST",
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to save post");
      }

      setLocalPost((prev) => ({
        ...prev,
        isSaved: data.isSaved,
        saves: data.saves,
      }));

      toast.success(data.isSaved ? "Post saved" : "Post removed from saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save post",
      );
    }
  };

  const handleCopyLink = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(
          `${window.location.origin}/cloak-watch/post/${localPost.id}`,
        );
      }
      await fetch(`/api/cloak-watch/posts/${localPost.id}/share`, {
        method: "POST",
      }).catch(() => null);
      toast.success("Post link has been copied");
    } catch {
      toast.error("Unable to copy post link");
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/cloak-watch/posts/${localPost.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to delete post");
      }

      setHidden(true);
      toast.success("Post deleted");
      onDeleted?.(localPost.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete post",
      );
    }
  };

  return (
    <>
      <article className="rounded-[22px] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-200">
              <Image
                src={localPost.avatarUrl}
                alt={localPost.username}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#2D2D2D]">
                {localPost.username}
              </p>
              <p className="text-[12px] text-[#98A0A7]">
                Level {localPost.level} • {time}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#98A0A7]"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-[14px] leading-6 text-[#2D2D2D]">
          {localPost.body}
        </p>

        <button
          type="button"
          onClick={() => onOpenPost?.(localPost)}
          className="relative mt-3 block w-full overflow-hidden rounded-[22px] bg-[#EDE7DE] text-left"
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
            className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          >
            {localPost.images.map((image, idx) => (
              <div
                key={`${localPost.id}-${idx}`}
                className="relative aspect-4/3 w-full shrink-0 snap-center"
              >
                <Image
                  src={image}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
          <CarouselDots
            total={localPost.images.length}
            activeIndex={activeImageIndex}
          />
        </button>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Upvote Button */}
            <button
              type="button"
              onClick={() => void handleVote(1)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold ${
                localPost.viewerVote === 1
                  ? "bg-[#E8FEFF] text-[#00C3D0]"
                  : "bg-[#F3F3F3] text-[#2B2B2B]"
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
              <span className="text-[#2B2B2B]">{localPost.up}</span>
            </button>

            {/* Downvote Button */}
            <button
              type="button"
              onClick={() => void handleVote(-1)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold ${
                localPost.viewerVote === -1
                  ? "bg-[#FFEDED] text-[#A84141]"
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
              <span className="text-[#2B2B2B]">{localPost.down}</span>
            </button>

            {/* Share Button (Unchanged) */}
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F6F6F6] text-[#2B2B2B]"
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
          </div>

          {/* Bookmark Button (Unchanged) */}
          <button
            type="button"
            onClick={() => void handleToggleSave()}
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              localPost.isSaved
                ? "bg-[#E8FEFF] text-[#00C3D0]"
                : "bg-[#F6F6F6] text-[#2B2B2B]"
            }`}
          >
            <Bookmark
              className={`h-5 w-5 ${localPost.isSaved ? "fill-current" : ""}`}
              strokeWidth={2.1}
            />
          </button>
        </div>
      </article>

      <OptionsSheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        isSaved={localPost.isSaved}
        isOwner={localPost.isOwner}
        onToggleSave={() => void handleToggleSave()}
        onCopyLink={() => void handleCopyLink()}
        onDelete={() => void handleDelete()}
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
    </>
  );
}
