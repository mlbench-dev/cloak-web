"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Info, Trash2, X, ChevronLeft } from "lucide-react";
import toast from "react-hot-toast";
import InfoScreen from "@/app/components/reference-media/InfoScreen";
import CaptureScreen from "@/app/components/reference-media/CaptureScreen";

type LocalImage = {
  file: File;
  previewUrl: string;
};

const getVerificationStatusLabel = (status?: string) => {
  switch (String(status || "pending").toLowerCase()) {
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
};

const getVerificationStatusClass = (status?: string) => {
  switch (String(status || "pending").toLowerCase()) {
    case "verified":
      return "bg-[#14C3CF] text-white";
    case "rejected":
      return "bg-[#FF3B30] text-white";
    default:
      return "bg-[#F59E0B] text-white";
  }
};

function ReferenceMediaContent() {
  const {
    data: session,
    status: authStatus,
    update: updateSession,
  } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const mode = searchParams.get("mode") || "profile";
  const [view, setView] = useState<"MAIN" | "INFO" | "CAPTURE">("MAIN");
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const [dbImages, setDbImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [needsReferenceMediaVerification, setNeedsReferenceMediaVerification] =
    useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchDbImages();
    }
  }, [authStatus]);

  const fetchDbImages = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/reference-media");
      const data = await response.json();
      if (data.success) {
        setDbImages(data.data || []);
        setNeedsReferenceMediaVerification(
          Boolean(data.needsReferenceMediaVerification),
        );
        return data.data || [];
      }
      toast.error(data.error || "Unable to load protected media.");
      return [];
    } catch (error) {
      console.error("Failed to fetch media:", error);
      toast.error("Unable to load protected media. Please try again.");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDbImage = async (mediaItem: any) => {
    const idToDelete = mediaItem.id || mediaItem._id?.toString();
    setDeletingId(idToDelete);
    try {
      const response = await fetch(`/api/reference-media/${idToDelete}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchDbImages();
        setShowVerificationMessage(false);
        toast.success("Protected image removed.");
      } else {
        const err = await response.json();
        console.error("Delete failed:", err);
        toast.error(err.error || "Unable to remove image.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Unable to remove image. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteLocalImage = (index: number) => {
    setLocalImages((prev) => prev.filter((_, i) => i !== index));
    setShowVerificationMessage(false);
  };

  const handleUploadLocalImages = async (images: LocalImage[]) => {
    if (images.length === 0) return;

    const existingCount = dbImages.length;
    const remainingSlots = 3 - existingCount;

    if (remainingSlots <= 0) {
      throw new Error(
        "Maximum 3 reference images allowed. Delete one image before adding another.",
      );
    }

    if (images.length > remainingSlots) {
      throw new Error(
        `You can only upload ${remainingSlots} more reference image${
          remainingSlots === 1 ? "" : "s"
        }.`,
      );
    }

    for (const localImg of images) {
      const formData = new FormData();
      formData.append("file", localImg.file);

      const response = await fetch("/api/reference-media/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }
    }
  };

  const handleCaptureComplete = async (newLocalImages: LocalImage[]) => {
    if (newLocalImages.length === 0) {
      setView("MAIN");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Uploading protected images...");
    try {
      await handleUploadLocalImages(newLocalImages);
      await fetchDbImages();
      setLocalImages([]);
      setShowVerificationMessage(true);
      toast.success("Protected images uploaded.", { id: toastId });
      setView("MAIN");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload images. Please try again.",
        {
          id: toastId,
        },
      );
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    setUploading(true);
    const uploadToastId =
      localImages.length > 0
        ? toast.loading("Uploading protected images...")
        : null;

    try {
      if (localImages.length > 0) {
        await handleUploadLocalImages(localImages);
        setLocalImages([]);
        setShowVerificationMessage(true);
        toast.success("Protected images uploaded.", {
          id: uploadToastId || undefined,
        });
      }

      const refreshedImages = await fetchDbImages();
      const requiredCount = 3;
      const hasRequiredImages = refreshedImages.length >= requiredCount;
      if (!hasRequiredImages) {
        if (uploadToastId) toast.dismiss(uploadToastId);
        toast.error("Please add 3 reference images before continuing.");
        setUploading(false);
        return;
      }

      const response = await fetch("/api/reference-media/verify", {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        console.error("Verification error:", data);
        toast.error(
          data?.error ||
            "Server not available, try again later from the Protected Media menu.",
        );
        return;
      }

      const verificationStatus = String(
        data?.identityVerificationStatus || "",
      ).toUpperCase();

      if (verificationStatus) {
        await updateSession({ identityVerificationStatus: verificationStatus });
      }

      if (mode === "onboarding") {
        toast.success(
          "Verification process started. You can check the result on Profile tab.",
        );
        router.push("/dashboard");
        return;
      }

      if (
        verificationStatus === "APPROVED" ||
        verificationStatus === "REJECTED"
      ) {
        router.replace(`/verification?status=${verificationStatus}`);
        return;
      }

      toast.success(
        "Verification started. You can check your status from the Verification screen.",
      );
      router.push("/profile");
    } catch (error) {
      console.error("Verification start failed:", error);
      if (uploadToastId) toast.dismiss(uploadToastId);
      toast.error("Unable to start verification. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Create exactly 3 slots array
  const actualImages = [
    ...dbImages,
    ...localImages.map((img, index) => ({
      id: `local-${index}`,
      imageUrl: img.previewUrl,
      isLocal: true,
      verificationStatus: "pending",
    })),
  ];

  const allImages: (any | null)[] = actualImages.slice(0, 3);
  while (allImages.length < 3) {
    allImages.push(null);
  }

  const totalImageCount = actualImages.length;
  const canUploadMore = totalImageCount < 3;
  const showExtraAddNew = mode === "profile" && totalImageCount >= 3;
  const gridItems = showExtraAddNew
    ? [...allImages, { addNew: true }]
    : allImages;

  const handleHeaderBack = () => {
    if (mode === "onboarding") {
      router.replace("/?authStep=IDENTITY");
      return;
    }

    const identityStatus = String(
      (session?.user as any)?.identityVerificationStatus || "",
    ).toUpperCase();
    if (identityStatus === "APPROVED" || !needsReferenceMediaVerification) {
      router.push("/profile");
      return;
    }

    router.back();
  };

  if (view === "INFO") {
    return <InfoScreen onClose={() => setView("MAIN")} />;
  }

  if (view === "CAPTURE") {
    return (
      <CaptureScreen
        dbImages={dbImages.map((img) => img.imageUrl)}
        localImages={localImages}
        onClose={() => setView("MAIN")}
        isSaving={uploading}
        onComplete={(newLocalImages) => {
          void handleCaptureComplete(newLocalImages);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white font-sf-pro-display">
      <header className="flex items-center justify-between py-4 px-4 bg-white z-10 flex-shrink-0">
        <button onClick={handleHeaderBack} className="p-2">
          <ChevronLeft className="h-6 w-6 text-slate-400" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">
          {mode === "onboarding" ? "Add Protected Media" : "Protected Media"}
        </h1>
        <div className="w-16 text-right">
          {mode === "onboarding" ? (
            <div className="w-10" />
          ) : (
            <div className="w-10" />
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-y-auto px-6 py-6">
        {/* Hero Banner */}
        {mode === "onboarding" && (
          <div className="relative mb-6 flex-shrink-0">
            <Image
              src="/images/referenceMedia/image_banner.png"
              alt="Protected Media Banner"
              width={400}
              height={300}
              className="w-full h-auto"
              priority
              unoptimized
            />
            <div className="absolute bottom-2 left-0 right-0 px-6">
              <button
                onClick={() => setView("CAPTURE")}
                className="w-full py-3 bg-white/20 backdrop-blur-md text-white rounded-full font-semibold border border-white/40 active:scale-95 transition-all"
              >
                Start Capturing
              </button>
            </div>
          </div>
        )}

        {/* Protected Media Section */}
        <div className="mb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[14px] text-[#2D2D2D]">
              Used for AI detection matching
            </h3>
            <button
              onClick={() => setView("INFO")}
              className="h-6 w-6 rounded-full flex items-center justify-center transition active:scale-95"
            >
              <Info className="h-5 w-5 text-[#2D2D2D] stroke-[1.25]" />
            </button>
          </div>
          {mode === "profile" &&
            showVerificationMessage &&
            totalImageCount > 0 && (
              <div className="mb-6 rounded-2xl border border-[#F59E0B]/20 bg-[#FFF7ED] p-4 text-[13px] leading-5 text-[#92400E]">
                You have uploaded new pictures, please verify yourself again.
              </div>
            )}

          {/* Upload Grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {gridItems.map((item, index) => {
                return (
                  <div key={index} className="relative aspect-square">
                    {item?.addNew ? (
                      <div
                        onClick={() => setShowUpgradeDialog(true)}
                        className={`h-full w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-1 transition-all ${
                          canUploadMore
                            ? "cursor-pointer hover:border-[#14C3CF] hover:bg-[#14C3CF]/5"
                            : "cursor-pointer opacity-70"
                        }`}
                      >
                        {uploading ? (
                          <div className="h-8 w-8 border-3 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
                        ) : (
                          <>
                            <div className="h-6 w-6 flex items-center justify-center">
                              <span className="text-[#2D2D2D] text-2xl font-light">
                                +
                              </span>
                            </div>
                            <p className="text-[11px] text-[#2D2D2D] font-medium">
                              Add New
                            </p>
                          </>
                        )}
                      </div>
                    ) : item ? (
                      <div
                        className="relative h-full w-full rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-slate-100"
                        onClick={() => setSelectedImage(item.imageUrl)}
                      >
                        <Image
                          src={item.imageUrl}
                          alt={`Reference ${index + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div
                          className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-1 text-[10px] font-semibold leading-none shadow-sm ${getVerificationStatusClass(item.verificationStatus)}`}
                        >
                          {getVerificationStatusLabel(item.verificationStatus)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if ((item as any).isLocal) {
                              handleDeleteLocalImage(index - dbImages.length);
                            } else {
                              handleDeleteDbImage(item);
                            }
                          }}
                          disabled={
                            deletingId === (item.id || item._id?.toString())
                          }
                          className="absolute top-1.5 right-1.5 h-7 w-7 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all disabled:opacity-50"
                        >
                          {deletingId === (item.id || item._id?.toString()) ? (
                            <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setView("CAPTURE")}
                        className="h-full w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#14C3CF] hover:bg-[#14C3CF]/5 transition-all"
                      >
                        {uploading ? (
                          <div className="h-8 w-8 border-3 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
                        ) : (
                          <>
                            <div className="h-6 w-6 flex items-center justify-center">
                              <span className="text-[#2D2D2D] text-2xl font-light">
                                +
                              </span>
                            </div>
                            <p className="text-[11px] text-[#2D2D2D] font-medium">
                              Add New
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Spacer to push buttons to bottom */}
        <div className="flex-1" />

        {/* Bottom Section */}
        <div className="px-0 pb-6 space-y-3 flex-shrink-0 mt-auto">
          {/* {mode === "onboarding" && (
            <button
              onClick={() => setShowConfirmDialog(true)}
              className="w-full h-14 bg-[#F5F5F5] text-[#8F98A0] rounded-full font-medium text-[15px] active:scale-[0.98] transition-all"
            >
              I will add this later from settings
            </button>
          )} */}

          <button
            onClick={handleContinue}
            disabled={totalImageCount < 3 || uploading}
            className={`w-full h-14 rounded-full font-semibold text-lg active:scale-[0.98] transition-all flex items-center justify-center ${
              totalImageCount >= 3
                ? "bg-[#14C3CF] text-white shadow-lg shadow-[#14C3CF]/20"
                : "bg-[#E5E5E5] text-[#8F98A0] cursor-not-allowed"
            }`}
          >
            {uploading ? (
              <div className="h-6 w-6 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : mode === "onboarding" ? (
              "Submit"
            ) : (
              "Verify Identity"
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {/* {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold mb-3 text-[#111827]">
              Identity Verification
            </h3>
            <p className="text-[#2D2D2D] mb-6">
              Are you sure you want to leave?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 h-12 rounded-full bg-slate-100 text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  router.push("/dashboard");
                }}
                className="flex-1 h-12 rounded-full bg-[#14C3CF] text-white font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )} */}

      {showUpgradeDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold mb-3 text-[#111827]">
              Subscribe to add more
            </h3>
            <p className="text-[#2D2D2D] mb-6">
              You need to subscribe to a plan to protect more images.
            </p>
            <button
              onClick={() => setShowUpgradeDialog(false)}
              className="w-full h-12 rounded-full bg-[#14C3CF] text-white font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-2 bg-white/20 rounded-full text-white"
          >
            <X className="h-6 w-6" />
          </button>
          <Image
            src={selectedImage}
            alt="Preview"
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      )}
    </div>
  );
}

export default function ReferenceMediaPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <ReferenceMediaContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
