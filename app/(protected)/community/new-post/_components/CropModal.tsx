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
        />
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
          className="w-full accent-[#15C3CF]"
        />

        <button
          type="button"
          onClick={() => pixels && onConfirmCrop(pixels)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#15C3CF] text-white"
        >
          <Check className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
