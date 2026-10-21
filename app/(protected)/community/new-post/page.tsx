"use client";
import { CLOAK_WATCH_IMAGE_ASPECT } from "../_lib/posts";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ImageIcon,
  Plus,
  Trash2,
  Crop as CropIcon,
} from "lucide-react";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import { showPlanLimitToast } from "@/app/components/planLimitToast";
import { PostSharedSuccessToast } from "../_components/PostUI";
import { CropModal } from "./_components/CropModal";
import { getCroppedImg } from "./_lib/cropImage";
import type { Area } from "react-easy-crop";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];

type LocalMedia = {
  id: string;
  file: File;
  previewUrl: string;
  // The untouched upload, so re-cropping starts from the full image rather
  // than the previous crop. Same as previewUrl until the first crop.
  originalUrl: string;
  cropPixels?: Area;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function revokeMediaUrls(item: LocalMedia) {
  URL.revokeObjectURL(item.previewUrl);
  if (item.originalUrl !== item.previewUrl) {
    URL.revokeObjectURL(item.originalUrl);
  }
}

export default function NewPostPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<LocalMedia[]>([]);
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const cropTargetMedia = media.find((m) => m.id === cropTargetId) ?? null;
  const [cropQueue, setCropQueue] = useState<string[]>([]);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => {
    return () => {
      mediaRef.current.forEach(revokeMediaUrls);
    };
  }, []);

  const handlePickMedia = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const oversized: File[] = [];
    const unsupportedType: File[] = [];
    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      // HEIC/HEIF (the default on iPhone cameras) can't be decoded by
      // browsers — <img>/<canvas> just render it blank, which is exactly
      // what was happening. Only accept formats we can actually preview,
      // crop, and re-encode client-side.
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        unsupportedType.push(file);
      } else if (file.size > MAX_IMAGE_SIZE_BYTES) {
        oversized.push(file);
      } else {
        accepted.push(file);
      }
    });

    if (unsupportedType.length > 0) {
      toast.error(
        unsupportedType.length === 1
          ? `${unsupportedType[0].name} isn't a supported format. Please upload a PNG or JPEG image.`
          : `${unsupportedType.length} files aren't a supported format. Please upload PNG or JPEG images.`,
      );
    }

    if (oversized.length > 0) {
      toast.error(
        oversized.length === 1
          ? `${oversized[0].name} is larger than 5MB. Please choose a smaller image.`
          : `${oversized.length} images are larger than 5MB and were skipped.`,
      );
    }

    if (accepted.length === 0) return;

    const nextItems: LocalMedia[] = accepted.map((file) => {
      const url = URL.createObjectURL(file);
      return { id: createId(), file, previewUrl: url, originalUrl: url };
    });
    setMedia((prev) => {
      const next = [...prev, ...nextItems];
      if (prev.length === 0) {
        setActiveIndex(0);
      } else {
        setActiveIndex(prev.length);
        requestAnimationFrame(() => {
          const slide = carouselRef.current?.children[prev.length];
          slide?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "start",
          });
        });
      }
      return next;
    });

    // queue the freshly added images and open the crop screen for the first one right away
    setCropQueue((prev) => [...prev, ...nextItems.map((item) => item.id)]);
    setCropTargetId((current) => current ?? nextItems[0]?.id ?? null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  const advanceCropQueue = (justHandledId: string) => {
    setCropQueue((prev) => {
      const next = prev.filter((id) => id !== justHandledId);
      setCropTargetId(next[0] ?? null);
      return next;
    });
  };
  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const removedIndex = prev.findIndex((item) => item.id === id);
      if (removedIndex === -1) return prev;
      revokeMediaUrls(prev[removedIndex]);
      const next = prev.filter((item) => item.id !== id);
      setActiveIndex((current) => {
        const shifted = removedIndex < current ? current - 1 : current;
        return Math.max(0, Math.min(shifted, next.length - 1));
      });
      return next;
    });
  };
  // Cancelling the crop for a just-uploaded image discards that upload;
  // cancelling a re-crop of an image already in the post keeps it as-is.
  const handleCropCancel = (id: string) => {
    if (cropQueue.includes(id)) removeMedia(id);
    advanceCropQueue(id);
  };
  const deleteActive = () => {
    const target = media[activeIndex];
    if (target) removeMedia(target.id);
  };
  const handleCropConfirm = async (pixels: Area) => {
    if (!cropTargetMedia) return;
    try {
      const croppedFile = await getCroppedImg(
        cropTargetMedia.originalUrl,
        pixels,
        cropTargetMedia.file.name,
        cropTargetMedia.file.type || "image/jpeg",
      );

      if (croppedFile.size > MAX_IMAGE_SIZE_BYTES) {
        toast.error(
          "The cropped image is still larger than 5MB. Please crop a smaller area.",
        );
        return;
      }

      const newPreviewUrl = URL.createObjectURL(croppedFile);

      setMedia((prev) =>
        prev.map((item) => {
          if (item.id !== cropTargetMedia.id) return item;
          if (item.previewUrl !== item.originalUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }
          return {
            ...item,
            file: croppedFile,
            previewUrl: newPreviewUrl,
            cropPixels: pixels,
          };
        }),
      );
    } catch {
      toast.error("Unable to crop image");
    } finally {
      advanceCropQueue(cropTargetMedia.id); // was: setCropTargetId(null)
    }
  };
  const handleSubmit = async () => {
    if (media.length === 0) {
      toast.error("Please add at least one image");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("body", description.trim());
      media.forEach((item) => {
        formData.append("images", item.file);
      });

      const response = await fetch("/api/community/posts", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        if (data?.code === "PLAN_LIMIT_REACHED") {
          showPlanLimitToast(data.error);
          setSubmitting(false);
          return;
        }
        throw new Error(data?.error || "Unable to post right now");
      }

      PostSharedSuccessToast("Your post was shared");
      // Replace, not push — the new-post form shouldn't linger in history
      // underneath the post detail page. This way the back button (which
      // uses router.back()) returns straight to the Cloak Watch feed instead
      // of back into the now-stale, already-submitted form.
      router.replace(`/community/post/${data.post.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to post right now",
      );
      setSubmitting(false);
    }
  };

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    // Slides are narrower than the viewport (the next one peeks in), so pick
    // the slide whose snap position is closest to the current scroll offset.
    const paddingLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    let closest = 0;
    let closestDistance = Infinity;
    Array.from(el.children).forEach((child, idx) => {
      const distance = Math.abs(
        (child as HTMLElement).offsetLeft - paddingLeft - el.scrollLeft,
      );
      if (distance < closestDistance) {
        closest = idx;
        closestDistance = distance;
      }
    });
    if (closest !== activeIndex) setActiveIndex(closest);
  };

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between px-4 py-4 bg-white z-10">
        <button type="button" onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">New Post</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="mt-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-full bg-slate-200">
              <Image
                src={
                  session?.user?.image ||
                  (session?.user as any)?.profileImage ||
                  "/images/placeholder_avatar.png"
                }
                alt={session?.user?.username || "user"}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[15px] font-medium text-[#2D2D2D]">
                  {session?.user?.username}
                </p>
                {(session?.user as any)?.identityVerificationStatus ===
                  "APPROVED" && (
                  <VerifiedBadge className="h-4 w-4 text-[#14C3CF]" />
                )}
              </div>
              {session?.user?.name && (
                <p className="text-[13px] text-[#98A0A7]">
                  {session.user.name}
                </p>
              )}
            </div>
          </div>

          {media.length === 0 ? (
            <button
              type="button"
              onClick={handlePickMedia}
              className="flex w-full items-center justify-center rounded-[22px] bg-[#F3F3F3]"
              style={{ aspectRatio: CLOAK_WATCH_IMAGE_ASPECT }}
            >
              <div className="flex flex-col items-center gap-3 text-[#98A0A7]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                  <ImageIcon className="h-5 w-5 text-[#15C3CF]" />
                </div>
                <span className="text-[14px] font-medium">Add media here</span>
              </div>
            </button>
          ) : (
            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 no-scrollbar"
            >
              {media.map((m, idx) => (
                <div
                  key={m.id}
                  className={`relative shrink-0 snap-start overflow-hidden rounded-[22px] bg-[#F3F3F3] ${
                    media.length > 1 ? "w-[92%]" : "w-full"
                  }`}
                >
                  <div
                    className="relative w-full"
                    style={{ aspectRatio: CLOAK_WATCH_IMAGE_ASPECT }}
                  >
                    <Image
                      src={m.previewUrl}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  {idx === activeIndex && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCropTargetId(m.id)}
                        aria-label="Crop image"
                        className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2D2D2D] shadow-sm"
                      >
                        <CropIcon className="h-5 w-5" />
                      </button>

                      <button
                        type="button"
                        onClick={deleteActive}
                        aria-label="Remove image"
                        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#E5484D] shadow-sm"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  {media.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/30 px-2 py-1.5">
                      {media.map((dot, dotIdx) => (
                        <div
                          key={dot.id}
                          className={`h-2 w-2 rounded-full ${
                            dotIdx === idx ? "bg-white" : "bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* A post needs media, so the description unlocks once some is added. */}
          <div
            className={`rounded-[18px] bg-[#F3F3F3] px-4 py-3 transition-opacity ${
              media.length === 0 ? "opacity-60" : ""
            }`}
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder={media.length === 0 ? "Add media to write a description" : "Add a description..."}
              rows={3}
              disabled={media.length === 0}
              className="w-full resize-none bg-transparent text-[14px] text-[#2D2D2D] outline-none placeholder:text-[#98A0A7] disabled:cursor-not-allowed"
            />
            <div className="flex justify-end text-[12px] text-[#98A0A7]">
              {description.length}/200
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </main>

      <footer className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="grid grid-cols-2 gap-3 py-2">
          <button
            type="button"
            onClick={handlePickMedia}
            disabled={submitting}
            className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#F3F3F3] text-[16px] font-medium text-[#2D2D2D] disabled:opacity-60"
          >
            <Plus className="h-5 w-5" />
            <span>Add Media</span>
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || media.length === 0}
            className="h-14 rounded-full bg-[#15C3CF] text-[16px] font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Posting..." : "Post"}
          </button>
        </div>
      </footer>
      {cropTargetMedia && (
        <CropModal
          key={cropTargetMedia.id}
          imageSrc={cropTargetMedia.originalUrl}
          initialCroppedAreaPixels={cropTargetMedia.cropPixels}
          aspect={CLOAK_WATCH_IMAGE_ASPECT} // was: aspect={1}
          onCancel={() => handleCropCancel(cropTargetMedia.id)}
          onConfirmCrop={handleCropConfirm}
        />
      )}
    </div>
  );
}
