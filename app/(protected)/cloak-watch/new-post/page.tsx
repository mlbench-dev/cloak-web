"use client";
import { CLOAK_WATCH_IMAGE_ASPECT } from "../_lib/posts";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ImageIcon,
  Plus,
  Trash2,
  Crop as CropIcon,
} from "lucide-react";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import { PostSharedSuccessToast } from "../_components/PostUI";
import { CropModal } from "./_components/CropModal";
import { getCroppedImg } from "./_lib/cropImage";
import type { Area } from "react-easy-crop";

type Step = 1 | 2 | 3;

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];

type LocalMedia = {
  id: string;
  file: File;
  previewUrl: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function NewPostPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<LocalMedia[]>([]);
  const [step, setStep] = useState<Step>(1);
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
      mediaRef.current.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    };
  }, []);

  const activeMedia = media[activeIndex];

  const handlePickMedia = () => {
    fileInputRef.current?.click();
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
      return;
    }
    router.back();
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

    const nextItems: LocalMedia[] = accepted.map((file) => ({
      id: createId(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setMedia((prev) => {
      const next = [...prev, ...nextItems];
      if (prev.length === 0) {
        setActiveIndex(0);
      } else {
        setActiveIndex(prev.length);
        requestAnimationFrame(() => {
          const el = carouselRef.current;
          if (!el) return;
          el.scrollTo({
            left: el.clientWidth * prev.length,
            behavior: "smooth",
          });
        });
      }
      setStep((currentStep) => (currentStep === 3 ? 3 : 2));
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
  const deleteActive = () => {
    setMedia((prev) => {
      const target = prev[activeIndex];
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((_, idx) => idx !== activeIndex);
      const nextIndex = Math.max(0, Math.min(activeIndex, next.length - 1));
      setActiveIndex(nextIndex);
      setStep((currentStep) => {
        if (next.length === 0) return 1;
        if (currentStep === 3) return 3;
        return 2;
      });
      return next;
    });
  };
  const handleCropConfirm = async (pixels: Area) => {
    if (!cropTargetMedia) return;
    try {
      const croppedFile = await getCroppedImg(
        cropTargetMedia.previewUrl,
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
          URL.revokeObjectURL(item.previewUrl);
          return { ...item, file: croppedFile, previewUrl: newPreviewUrl };
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

      const response = await fetch("/api/cloak-watch/posts", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to post right now");
      }

      PostSharedSuccessToast("Your post was shared");
      // Replace, not push — the new-post form shouldn't linger in history
      // underneath the post detail page. This way the back button (which
      // uses router.back()) returns straight to the Cloak Watch feed instead
      // of back into the now-stale, already-submitted form.
      router.replace(`/cloak-watch/post/${data.post.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to post right now",
      );
      setSubmitting(false);
    }
  };

  const dots = useMemo(() => {
    if (media.length <= 1) return null;
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {media.map((m, idx) => (
          <div
            key={m.id}
            className={`h-1.5 w-1.5 rounded-full ${
              idx === activeIndex ? "bg-white" : "bg-white/60"
            }`}
          />
        ))}
      </div>
    );
  }, [activeIndex, media]);

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between px-4 py-4 bg-white z-10">
        <button type="button" onClick={handleBack} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">New Post</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {step === 1 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={handlePickMedia}
              className="flex w-full items-center justify-center rounded-[22px] bg-[#F3F3F3] px-6 py-20"
            >
              <div className="flex flex-col items-center gap-3 text-[#98A0A7]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                  <ImageIcon className="h-5 w-5 text-[#15C3CF]" />
                </div>
                <span className="text-[14px] font-medium">Add media here</span>
              </div>
            </button>
          </div>
        )}

        {step === 2 && activeMedia && (
          <div className="mt-8 flex items-center justify-center">
            <div className="relative w-full max-w-[320px] overflow-hidden rounded-[22px] bg-[#F3F3F3]">
              <div
                ref={carouselRef}
                onScroll={() => {
                  const el = carouselRef.current;
                  if (!el) return;
                  const width = el.clientWidth || 1;
                  const idx = Math.round(el.scrollLeft / width);
                  const bounded = Math.max(0, Math.min(idx, media.length - 1));
                  if (bounded !== activeIndex) setActiveIndex(bounded);
                }}
                className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain no-scrollbar"
              >
                {media.map((item) => (
                  <div
                    key={item.id}
                    className="relative w-full shrink-0 snap-center"
                  >
                    <div
                      className="relative w-full"
                      style={{ aspectRatio: CLOAK_WATCH_IMAGE_ASPECT }}
                    >
                      <Image
                        src={item.previewUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* ADD THIS */}
              <button
                type="button"
                onClick={() => activeMedia && setCropTargetId(activeMedia.id)}
                className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white"
              >
                <CropIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={deleteActive}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              {dots}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-200">
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
                  <p className="text-[14px] font-semibold text-[#2D2D2D]">
                    {session?.user?.username || "harry67"}
                  </p>
                  {(session?.user as any)?.identityVerificationStatus ===
                    "APPROVED" && (
                    <VerifiedBadge className="h-4 w-4 text-[#14C3CF]" />
                  )}
                </div>
                <p className="text-[12px] text-[#98A0A7]">
                  {session?.user?.name || "Harry"}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[22px] bg-[#F3F3F3]">
              <div
                ref={carouselRef}
                onScroll={() => {
                  const el = carouselRef.current;
                  if (!el) return;
                  const width = el.clientWidth || 1;
                  const idx = Math.round(el.scrollLeft / width);
                  const bounded = Math.max(0, Math.min(idx, media.length - 1));
                  if (bounded !== activeIndex) setActiveIndex(bounded);
                }}
                className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain no-scrollbar"
              >
                {media.map((m, idx) => (
                  <div
                    key={m.id}
                    className="relative w-full shrink-0 snap-center"
                    style={{ width: "100%" }}
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
                          className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white"
                        >
                          <CropIcon className="h-5 w-5" />
                        </button>

                        <button
                          type="button"
                          onClick={deleteActive}
                          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {dots}
            </div>

            <div className="rounded-[18px] bg-[#F3F3F3] px-4 py-3">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                placeholder="Add a description..."
                rows={3}
                className="w-full resize-none bg-transparent text-[14px] text-[#2D2D2D] outline-none placeholder:text-[#98A0A7]"
              />
              <div className="flex justify-end text-[12px] text-[#98A0A7]">
                {description.length}/200
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-14 w-full rounded-full bg-[#15C3CF] text-[16px] font-semibold text-white"
              >
                {submitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        )}

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
        {step === 1 ? (
          <div className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={handlePickMedia}
              className="flex h-12 items-center gap-2 rounded-full bg-[#F3F3F3] px-5 text-[14px] font-medium text-[#2D2D2D]"
            >
              <span className="text-[18px] leading-none">+</span>
              <span>Add Media</span>
            </button>
            <button
              type="button"
              onClick={handlePickMedia}
              aria-disabled="true"
              className="flex h-12 items-center gap-2 rounded-full bg-[#839297] px-6 text-[14px] font-semibold text-white cursor-not-allowed"
            >
              <span>Next</span>
              <span className="text-[18px] leading-none">›</span>
            </button>
          </div>
        ) : step === 2 ? (
          <div className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={handlePickMedia}
              className="flex h-12 items-center gap-2 rounded-full bg-[#F3F3F3] px-5 text-[14px] font-medium text-[#2D2D2D]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Media</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex h-12 items-center gap-2 rounded-full bg-[#15C3CF] px-6 text-[14px] font-semibold text-white"
            >
              <span>Next</span>
              <span className="text-[18px] leading-none">›</span>
            </button>
          </div>
        ) : (
          <div className="h-4" />
        )}
      </footer>
      {cropTargetMedia && (
        <CropModal
          imageSrc={cropTargetMedia.previewUrl}
          aspect={CLOAK_WATCH_IMAGE_ASPECT} // was: aspect={1}
          onCancel={() => advanceCropQueue(cropTargetMedia.id)} // was: () => setCropTargetId(null)
          onConfirmCrop={handleCropConfirm}
        />
      )}
    </div>
  );
}
