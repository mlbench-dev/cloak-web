"use client";

import Image from "next/image";
import { ChevronLeft } from "lucide-react";

type InfoScreenProps = {
  onClose: () => void;
};

export default function InfoScreen({ onClose }: InfoScreenProps) {
  return (
    <div className="flex flex-col h-full bg-white font-sf-pro-display">
      <div className="flex justify-center pt-3">
        <div className="w-10 h-1 bg-slate-200 rounded-full" />
      </div>
      <header className="flex items-center py-4 px-4">
        <button onClick={onClose} className="p-2">
          <ChevronLeft className="h-6 w-6 text-slate-400" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-[#2D2D2D] mr-10">
          How to choose the right photos
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-6">
          <p className="text-[#8F98A0] text-[15px] leading-relaxed">
            Make sure your face is clearly visible in recent, solo photos with good lighting. Avoid group shots, heavy filters & inappropriate backgrounds.
          </p>

          <div className="space-y-4">
            <h3 className="font-bold text-[#2D2D2D] text-[16px]">Correct way of uploading photos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm">
                <Image
                  src="/images/referenceMedia/image_3.png"
                  alt="Correct 1"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm">
                <Image
                  src="/images/referenceMedia/image_4.png"
                  alt="Correct 2"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2 pb-8">
            <h3 className="font-bold text-[#2D2D2D] text-[16px]">Incorrect way of uploading photos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm">
                <Image
                  src="/images/referenceMedia/image_1.png"
                  alt="Incorrect 1"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm">
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
    </div>
  );
}
