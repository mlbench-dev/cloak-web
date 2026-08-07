"use client";

import Image from "next/image";
import { useRef, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropImage";

type ProfilePicStepProps = {
  onContinue: (image: File | null) => void;
  onSkip: () => void;
  error?: string | null;
};

export default function ProfilePicStep({
  onContinue,
  onSkip,
  error,
}: ProfilePicStepProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImageSrc(reader.result as string);
      });
      reader.readAsDataURL(file);
    }
    // Reset input value to allow selecting same file again
    e.target.value = "";
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImageSrc(reader.result as string);
      });
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleTriggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const handleApplyCrop = async () => {
    try {
      if (imageSrc && croppedAreaPixels) {
        const croppedImageBlob = await getCroppedImg(
          imageSrc,
          croppedAreaPixels,
        );
        const file = new File([croppedImageBlob], "profile-picture.jpg", {
          type: "image/jpeg",
        });
        setSelectedFile(file);

        // Create a data URL from the blob to show the actual cropped image
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(croppedImageBlob);

        setImageSrc(null); // Clear imageSrc to go back to preview view
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="font-sf-pro-display flex h-full justify-center bg-[#F5F5F5] text-[#2D2D2D]">
      <div className="w-full max-w-[390px] px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex flex-col items-start h-full">
          <div className="flex w-full items-center justify-between mb-9">
            <Image
              src="/images/logo/cloakLogo.svg"
              alt="Cloak logo"
              width={34}
              height={39}
              priority
            />
            <span className="text-[13px] font-semibold tracking-wider text-[#14C3CF]">
              STEP 2/3
            </span>
          </div>

          <div className="mb-8 space-y-2">
            <h1 className="text-[24px] font-[600] leading-[1.2] tracking-[-0.03em] text-[#2D2D2D] 2xl:text-[30px]">
              Upload Your Photo
            </h1>
            <p className="max-w-[280px] text-[14px] leading-6 text-[#8F98A0] 2xl:max-w-[320px] 2xl:text-[16px]">
              Upload a profile picture with your face visible so we can verify
              your identity later
            </p>
          </div>

          <div className="w-full space-y-4">
            {error && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-2 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-[#FF3B30]/10">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#FF3B30] text-[#FF3B30] text-[12px] font-bold">
                    !
                  </div>
                  <p className="text-[13px] font-medium text-[#2D2D2D]">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full flex flex-col items-center justify-center flex-1">
            {imageSrc ? (
              <div className="relative w-full aspect-square max-w-[300px] border-2 border-dashed border-[#14C3CF] rounded-2xl overflow-hidden bg-black shadow-2xl">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
            ) : (
              <div className="relative">
                <div className="cursor-pointer" onClick={handleTriggerUpload}>
                  <div className="h-[180px] w-[180px] rounded-full bg-[#E5E5E5] flex items-center justify-center border-4 border-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all hover:scale-[1.02]">
                    {previewUrl ? (
                      <div className="relative w-full h-full rounded-full overflow-hidden">
                        <img
                          src={previewUrl}
                          alt="Profile preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <svg
                        width="100"
                        height="100"
                        viewBox="0 0 100 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle cx="50" cy="35" r="20" fill="#C4C4C4" />
                        <path
                          d="M15 85C15 65.67 30.67 50 50 50C69.33 50 85 65.67 85 85"
                          fill="#C4C4C4"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTriggerCamera();
                  }}
                  className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#14C3CF] border-4 border-[#F5F5F5] shadow-sm active:scale-90 transition-transform"
                >
                  <svg
                    width="18"
                    height="16"
                    viewBox="0 0 18 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M16 14V5C16 4.44772 15.5523 4 15 4H13L12 2H6L5 4H3C2.44772 4 2 4.44772 2 5V14C2 14.5523 2.44772 15 3 15H15C15.5523 15 16 14.5523 16 14Z"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="9"
                      cy="9.5"
                      r="2.5"
                      stroke="white"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Hidden file inputs - placed outside clickable area to prevent accidental triggers */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleCameraChange}
          />

          <div className="w-full mt-auto pt-6 flex gap-3">
            {imageSrc ? (
              <>
                <button
                  type="button"
                  onClick={() => setImageSrc(null)}
                  className="flex-1 h-14 rounded-full bg-[#ECECEC] text-[16px] font-medium text-[#2D2D2D]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  className="flex-[1.5] h-14 rounded-full bg-[#14C3CF] text-[18px] font-medium text-white shadow-[0_10px_24px_rgba(20,195,207,0.22)]"
                >
                  Apply
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onSkip}
                  className="flex-1 h-14 rounded-full bg-[#ECECEC] text-[16px] font-medium text-[#2D2D2D] hover:bg-[#E0E0E0] transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  disabled={!selectedFile || isLoading}
                  onClick={async () => {
                    if (!selectedFile) return;
                    setIsLoading(true);
                    await onContinue(selectedFile);
                    setIsLoading(false);
                  }}
                  className={`flex-[1.5] h-14 rounded-full text-[18px] font-medium text-white shadow-lg transition-all ${
                    selectedFile
                      ? "bg-[#14C3CF] shadow-[0_10px_24px_rgba(20,195,207,0.22)]"
                      : "bg-[#839297] opacity-50 cursor-not-allowed"
                  }`}
                >
                  {isLoading ? (
                    <div className="h-6 w-6 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    "Continue"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
