"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Check, X } from "lucide-react";

type CropModalProps = {
  imageSrc: string;
  aspect?: number;
  // Restores the previous crop when re-cropping an image.
  initialCroppedAreaPixels?: Area;
  onCancel: () => void;
  onConfirmCrop: (pixels: Area) => void;
};

export function CropModal({
  imageSrc,
  aspect = 1,
  initialCroppedAreaPixels,
  onCancel,
  onConfirmCrop,
}: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  // Big phone photos take a moment to decode — until then the cropper is
  // just black. Tracked per source, since the modal is reused for each
  // image in the crop queue.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === imageSrc;
  const failed = failedSrc === imageSrc;

  const handleCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setPixels(croppedAreaPixels);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          initialCroppedAreaPixels={initialCroppedAreaPixels}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          onMediaLoaded={() => setLoadedSrc(imageSrc)}
          mediaProps={{ onError: () => setFailedSrc(imageSrc) }}
        />
        {!loaded && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            {failed ? (
              <p className="text-[14px] leading-5 text-white/80">
                Couldn&apos;t open this photo. Please try a different one.
              </p>
            ) : (
              <>
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-white/20 border-t-[#15C3CF]" />
                <p className="text-[13px] leading-5 text-white/70">Loading photo…</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 bg-black px-6 py-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          disabled={!loaded}
          className="w-full accent-[#15C3CF] disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => pixels && onConfirmCrop(pixels)}
          disabled={!loaded || !pixels}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#15C3CF] text-white disabled:opacity-40"
        >
          <Check className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
