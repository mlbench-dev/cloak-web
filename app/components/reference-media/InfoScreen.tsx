"use client";

import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import BottomSheet from "@/app/components/BottomSheet";

type InfoScreenProps = {
  onClose: () => void;
};

export default function InfoScreen({ onClose }: InfoScreenProps) {
  // The parent unmounts this screen in onClose, so close locally first and
  // only hand off once the slide-down has finished.
  const [open, setOpen] = useState(true);
  const handleClose = () => setOpen(false);

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      onExited={onClose}
      panelClassName="flex h-[min(95dvh,calc(var(--app-height,100dvh)*0.9))] flex-col overflow-hidden shadow-[0_-4px_24px_rgba(0,0,0,0.12)]"
    >
      <header className="flex items-center p-2 justify-between bg-white z-10">
        <button onClick={handleClose} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
          How to choose the right photos
        </h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <div className="space-y-5">
          <p className="text-[#839297] text-[14px] leading-5">
            Make sure your face is clearly visible in recent, solo photos with
            good lighting. Avoid group shots, heavy filters & inappropriate
            backgrounds.
          </p>

          <div className="space-y-2.5">
            <h3 className="font-medium text-[#2B2B2B] text-[16px] leading-[22px]">
              Correct way of uploading photos
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative aspect-[3/4] rounded-[20px] overflow-hidden">
                <Image
                  src="/images/referenceMedia/image_3.png"
                  alt="Correct 1"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative aspect-[3/4] rounded-[20px] overflow-hidden">
                <Image
                  src="/images/referenceMedia/image_4.png"
                  alt="Correct 2"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pb-8">
            <h3 className="font-medium text-[#2B2B2B] text-[16px] leading-[22px]">
              Incorrect way of uploading photos
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative aspect-[3/4] rounded-[20px] overflow-hidden">
                <Image
                  src="/images/referenceMedia/image_1.png"
                  alt="Incorrect 1"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative aspect-[3/4] rounded-[20px] overflow-hidden">
                <Image
                  src="/images/referenceMedia/image_2.png"
                  alt="Incorrect 2"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
