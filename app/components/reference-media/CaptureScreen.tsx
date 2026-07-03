"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ImagePlus,
  Plus,
  RefreshCcw,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import Webcam from "react-webcam";

type LocalImage = {
  file: File;
  previewUrl: string;
};

type CaptureScreenProps = {
  dbImages: string[];
  localImages: LocalImage[];
  onComplete: (localImages: LocalImage[]) => void;
  onClose: () => void;
  isSaving?: boolean;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default function CaptureScreen({
  dbImages,
  localImages,
  onComplete,
  onClose,
  isSaving = false,
}: CaptureScreenProps) {
  const [capturedFiles, setCapturedFiles] = useState<(File | null)[]>(() => {
    const files: (File | null)[] = [];
    for (let i = 0; i < dbImages.length; i++) {
      if (files.length < 3) files.push(null);
    }
    for (let i = 0; i < localImages.length; i++) {
      if (files.length < 3) files.push(localImages[i].file);
    }
    while (files.length < 3) files.push(null);
    return files;
  });
  const [previews, setPreviews] = useState<(string | null)[]>(() => {
    const arr: (string | null)[] = [
      ...dbImages,
      ...localImages.map((img) => img.previewUrl),
    ].slice(0, 3);
    while (arr.length < 3) arr.push(null);
    return arr;
  });
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [showShutterFlash, setShowShutterFlash] = useState(false);
  const shutterFlashTimeoutRef = useRef<number | null>(null);
  const previewsRef = useRef<(string | null)[]>(previews);
  const capturedFilesRef = useRef<(File | null)[]>(capturedFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const frameVideoRef = useRef<HTMLVideoElement>(null);
  const captureFrameRef = useRef<HTMLDivElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      if (shutterFlashTimeoutRef.current) {
        window.clearTimeout(shutterFlashTimeoutRef.current);
      }
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    previewsRef.current = previews;
    capturedFilesRef.current = capturedFiles;
  }, [capturedFiles, previews]);

  useEffect(() => {
    const videos = [backgroundVideoRef.current, frameVideoRef.current];

    videos.forEach((video) => {
      if (!video) return;
      video.srcObject = mediaStream;
      if (mediaStream) {
        void video.play().catch(() => {});
      }
    });

    return () => {
      videos.forEach((video) => {
        if (!video) return;
        video.srcObject = null;
      });
    };
  }, [mediaStream]);

  const videoConstraints = useMemo(
    () => ({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode,
    }),
    [facingMode],
  );

  const findNextSlot = (items: (string | null)[]) => items.findIndex((p) => !p);

  const validateFileSize = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Each image must be 5 MB or smaller.");
      return false;
    }

    return true;
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(validateFileSize);
    if (validFiles.length === 0) return;

    const nextPreviews = [...previewsRef.current];
    const nextFiles = [...capturedFilesRef.current];

    for (const file of validFiles) {
      const idx = findNextSlot(nextPreviews);
      if (idx === -1) break;

      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(previewUrl);
      nextPreviews[idx] = previewUrl;
      nextFiles[idx] = file;
    }

    previewsRef.current = nextPreviews;
    capturedFilesRef.current = nextFiles;
    setPreviews(nextPreviews);
    setCapturedFiles(nextFiles);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSaving) return;
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const remainingSlots = 3 - previews.filter((p) => p).length;
      const filesToAdd = files.slice(0, remainingSlots);
      addFiles(filesToAdd);
    }
    if (e.target) e.target.value = "";
  };

  const captureSelectedArea = async () => {
    const video = webcamRef.current?.video;
    const previewVideo = frameVideoRef.current;
    const frame = captureFrameRef.current;

    if (
      !video ||
      !previewVideo ||
      !frame ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      throw new Error("Camera is not ready yet.");
    }

    const previewRect = previewVideo.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();

    // `object-cover` scales the camera feed uniformly and clips overflow.
    // Map the visible frame back into the source video using that cover scale.
    const coverScale = Math.max(
      previewRect.width / video.videoWidth,
      previewRect.height / video.videoHeight,
    );
    const renderedWidth = video.videoWidth * coverScale;
    const renderedHeight = video.videoHeight * coverScale;
    const overflowX = Math.max(0, (renderedWidth - previewRect.width) / 2);
    const overflowY = Math.max(0, (renderedHeight - previewRect.height) / 2);

    const cropX = Math.max(
      0,
      (frameRect.left - previewRect.left + overflowX) / coverScale,
    );
    const cropY = Math.max(
      0,
      (frameRect.top - previewRect.top + overflowY) / coverScale,
    );
    const cropWidth = Math.min(
      video.videoWidth - cropX,
      frameRect.width / coverScale,
    );
    const cropHeight = Math.min(
      video.videoHeight - cropY,
      frameRect.height / coverScale,
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cropWidth);
    canvas.height = Math.round(cropHeight);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to process captured image.");
    }

    context.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      throw new Error("Unable to save captured image.");
    }

    return new File([blob], `capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
  };

  const handleCapture = async () => {
    if (isSaving) return;

    try {
      setShowShutterFlash(true);
      if (shutterFlashTimeoutRef.current) {
        window.clearTimeout(shutterFlashTimeoutRef.current);
      }
      shutterFlashTimeoutRef.current = window.setTimeout(() => {
        setShowShutterFlash(false);
        shutterFlashTimeoutRef.current = null;
      }, 140);
      const file = await captureSelectedArea();
      addFiles([file]);
    } catch (error) {
      console.error("Capture failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to capture photo right now.";
      setCameraError(message);
      toast.error(message);
      if (shutterFlashTimeoutRef.current) {
        window.clearTimeout(shutterFlashTimeoutRef.current);
        shutterFlashTimeoutRef.current = null;
      }
      setShowShutterFlash(false);
    }
  };

  const handleComplete = () => {
    if (isSaving) return;

    const newLocalImages: LocalImage[] = [];
    for (let i = 0; i < capturedFiles.length; i++) {
      const file = capturedFiles[i];
      const preview = previews[i];
      if (file && preview) {
        newLocalImages.push({ file, previewUrl: preview });
      }
    }
    onComplete(newLocalImages);
  };

  const currentCount = previews.filter((p) => p).length;
  const nextImageNumber = Math.min(currentCount + 1, 3);
  const isReadyToComplete = currentCount === 3;
  const canAddMore = currentCount < 3 && !isSaving;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#0E0A08] font-sf-pro-display text-white">
      {!cameraError && (
        <div className="absolute inset-0 overflow-hidden">
          <video
            ref={backgroundVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full scale-[1.05] object-cover blur-[10px] brightness-[0.45]"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.2)_22%,rgba(0,0,0,0.24)_78%,rgba(0,0,0,0.34))]" />
      <div className="absolute inset-0 opacity-0 pointer-events-none">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          mirrored={false}
          onUserMedia={(stream) => {
            setMediaStream(stream);
            setCameraError(null);
          }}
          onUserMediaError={(error) => {
            console.error("Camera error:", error);
            setMediaStream(null);
            setCameraError("Allow camera access or upload a photo instead.");
          }}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="relative flex h-full flex-col px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1rem)]">
        <header className="relative flex items-center justify-between pt-1 h-12">
          <div className="flex w-20 justify-start z-20">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/15 text-white disabled:opacity-50 transition active:scale-95"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          </div>

          <h1 className="absolute inset-x-0 mx-auto text-center text-[17px] font-semibold tracking-wide text-white pointer-events-none z-10">
            Quick Cloak
          </h1>

          <div className="flex w-20 justify-end z-20">
            <p className="text-right text-[15px] font-semibold text-[#00D0E6]">
              Image {nextImageNumber}/3
            </p>
          </div>
        </header>

        <div className="mx-auto mt-6 flex w-full max-w-[268px] justify-between items-center gap-2.5 rounded-[24px] border border-white/10 bg-black/28 p-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          {[0, 1, 2].map((index) => {
            const preview = previews[index];

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (!preview && canAddMore) {
                    fileInputRef.current?.click();
                  }
                }}
                disabled={
                  (Boolean(preview) && !isReadyToComplete) || !canAddMore
                }
                className={`relative flex h-[82px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] transition ${
                  preview
                    ? "bg-[#1E1B19] shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
                    : "bg-white/12 text-white"
                } ${!preview && canAddMore ? "active:scale-[0.98]" : ""}`}
              >
                {preview ? (
                  <Image
                    src={preview}
                    alt={`Captured ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-0.5 text-center px-1">
                    <Plus className="h-4 w-4 text-white/80" />
                    <span className="text-[11px] font-medium text-white/70 leading-tight">
                      Add New
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative flex flex-1 items-center justify-center pb-6 pt-6">
          <div
            ref={captureFrameRef}
            className="relative aspect-[4/5] w-full max-w-[430px] overflow-hidden rounded-[40px] border-4 border-white bg-transparent shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
          >
            {cameraError ? (
              <div className="flex h-full flex-col items-center justify-center bg-[#1A1715] px-8 text-center">
                <ImagePlus className="h-10 w-10 text-white/75" />
                <p className="mt-4 text-[15px] font-medium text-white">
                  Camera unavailable
                </p>
                <p className="mt-2 text-sm text-white/70">{cameraError}</p>
              </div>
            ) : (
              <>
                <video
                  ref={frameVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full scale-[1] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/10" />
              </>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[350px] rounded-[36px] border border-white/10 bg-[#1E1B19]/50 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2">
            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canAddMore}
              className="flex h-12 w-12 items-center justify-center justify-self-start rounded-full bg-white/10 border border-white/5 text-white transition active:scale-95 disabled:opacity-40"
            >
              <Upload className="h-5 w-5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleCapture}
              disabled={isReadyToComplete || isSaving || Boolean(cameraError)}
              className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full border-2 border-white bg-white/5 transition active:scale-95 disabled:opacity-30 mx-4"
            >
              <div className="h-[64px] w-[64px] rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.3)]" />
            </button>

            {/* Contextual Action Button (Flip Cam or Submit Complete) */}
            <button
              type="button"
              onClick={() => {
                if (isReadyToComplete) {
                  handleComplete();
                  return;
                }
                if (!isSaving) {
                  setFacingMode((current) =>
                    current === "user" ? "environment" : "user",
                  );
                }
              }}
              disabled={isSaving}
              className={`flex h-12 w-12 items-center justify-center justify-self-end rounded-full transition active:scale-95 disabled:opacity-40 ${
                isReadyToComplete
                  ? "bg-[#00D0E6] text-white shadow-[0_0_15px_rgba(0,208,230,0.35)]"
                  : "bg-white/10 border border-white/5 text-white"
              }`}
            >
              {isSaving ? (
                <span className="h-5 w-5 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
              ) : isReadyToComplete ? (
                <Check className="h-5 w-5 stroke-[2.5]" />
              ) : (
                <RefreshCcw className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isSaving && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm">
          <span className="h-12 w-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
          <p className="mt-4 text-[14px] font-medium text-white">
            Uploading images...
          </p>
        </div>
      )}

      <div
        className={`pointer-events-none absolute inset-0 z-40 bg-white transition-opacity duration-150 ${
          showShutterFlash ? "opacity-70" : "opacity-0"
        }`}
      />
    </div>
  );
}
