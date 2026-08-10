"use client";

import Image from "next/image";
import { ReactNode, useEffect, useRef, useState } from "react";
import { BadgeCheckIcon } from "@/public/svgIcons";
import { ShieldCheck, X, BadgeCheck } from "lucide-react";

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
      className="fixed inset-x-0 top-0 z-50 flex h-dvh items-end bg-black/20"
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

const getIdentityDraftStorageKey = (scopeKey?: string | null) =>
  `cloak-identity-verification-draft:${scopeKey || "anonymous"}`;

type VerificationFileItem =
  | {
      kind: "local";
      file: File;
      name: string;
      previewUrl: string;
    }
  | {
      kind: "uploaded";
      name: string;
      previewUrl: string;
      url: string;
    };

type IdentityVerificationStepProps = {
  onSkip: () => void;
  onSubmit: (data: {
    documentType: string;
    files: File[];
    existingUrls?: string[];
  }) => void | Promise<boolean | void>;
  onContinueToDashboard: () => void;
  error?: string | null;
  hideHeader?: boolean;
  showSkip?: boolean;
  status?: string | null;
  isLoading?: boolean;
  maxFiles?: number;
  prefillFromSavedVerification?: boolean;
  draftScopeKey?: string | null;
};

const DOCUMENT_TYPES = [
  "National Identity Card",
  "Driver's License",
  "Passport",
];

export default function IdentityVerificationStep({
  onSkip,
  onSubmit,
  onContinueToDashboard,
  error,
  hideHeader = false,
  showSkip = true,
  status,
  isLoading = false,
  maxFiles = 1,
  prefillFromSavedVerification = true,
  draftScopeKey = null,
}: IdentityVerificationStepProps) {
  const [step, setStep] = useState<"upload" | "submitted">("upload");
  const [documentType, setDocumentType] = useState("");
  const [showDocTypeMenu, setShowDocTypeMenu] = useState(false);
  const [showGuidelineSheet, setShowGuidelineSheet] = useState(true);
  const [files, setFiles] = useState<VerificationFileItem[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPreviewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const storageKey = getIdentityDraftStorageKey(draftScopeKey);
    if (status === "APPROVED" || status === "REJECTED") {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    let isCancelled = false;

    const applyPrefill = (
      nextDocumentType?: string | null,
      nextDocumentUrls?: string[] | null,
    ) => {
      if (isCancelled) return false;

      setDocumentType(nextDocumentType || "");
      setFiles(
        Array.isArray(nextDocumentUrls)
          ? nextDocumentUrls.slice(0, maxFiles).map((url, index) => ({
              kind: "uploaded" as const,
              url,
              previewUrl: url,
              name: `Document ${index + 1}`,
            }))
          : [],
      );
      return Boolean(
        nextDocumentType ||
        (Array.isArray(nextDocumentUrls) && nextDocumentUrls.length),
      );
    };

    const restorePrefill = async () => {
      setDocumentType("");
      setFiles([]);

      try {
        const savedDraft = window.sessionStorage.getItem(storageKey);

        if (savedDraft) {
          const parsedDraft = JSON.parse(savedDraft) as {
            documentType?: string;
            documentUrls?: string[];
          };

          const hasDraft = applyPrefill(
            parsedDraft.documentType,
            parsedDraft.documentUrls,
          );
          if (hasDraft) {
            return;
          }
        }
      } catch (draftError) {
        console.error("Failed to restore identity draft:", draftError);
      }

      if (!prefillFromSavedVerification) {
        return;
      }

      try {
        const response = await fetch("/api/auth/identity-verify", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          return;
        }

        const hasServerPrefill = applyPrefill(
          data?.documentType,
          Array.isArray(data?.documentUrls) ? data.documentUrls : [],
        );

        if (hasServerPrefill) {
          try {
            window.sessionStorage.setItem(
              storageKey,
              JSON.stringify({
                documentType: data?.documentType || "",
                documentUrls: Array.isArray(data?.documentUrls)
                  ? data.documentUrls
                  : [],
              }),
            );
          } catch (storageError) {
            console.error(
              "Failed to persist restored identity draft:",
              storageError,
            );
          }
        }
      } catch (serverError) {
        console.error(
          "Failed to fetch saved identity verification:",
          serverError,
        );
      }
    };

    void restorePrefill();

    return () => {
      isCancelled = true;
    };
  }, [draftScopeKey, maxFiles, prefillFromSavedVerification, status]);

  useEffect(() => {
    return () => {
      localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    setFiles((prev) => {
      const remainingSlots = maxFiles - prev.length;
      if (remainingSlots <= 0) {
        setFieldError(
          `You can upload a maximum of ${maxFiles} document image${maxFiles === 1 ? "" : "s"}.`,
        );
        return prev;
      }

      const filesToAdd = newFiles.slice(0, remainingSlots);
      const localItems = filesToAdd.map((file) => ({
        kind: "local" as const,
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      }));
      localItems.forEach((item) =>
        localPreviewUrlsRef.current.push(item.previewUrl),
      );
      if (newFiles.length > remainingSlots) {
        setFieldError(
          `Only ${maxFiles} document image${maxFiles === 1 ? "" : "s"} can be uploaded.`,
        );
      } else {
        setFieldError(null);
      }
      return [...prev, ...localItems];
    });

    if (e.target) e.target.value = "";
  };

  const handleAddFileClick = () => {
    if (!documentType) {
      setFieldError("Please select a document type first.");
      return;
    }
    setFieldError(null);
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const itemToRemove = prev[index];
      if (itemToRemove?.kind === "local") {
        URL.revokeObjectURL(itemToRemove.previewUrl);
        localPreviewUrlsRef.current = localPreviewUrlsRef.current.filter(
          (url) => url !== itemToRemove.previewUrl,
        );
      }
      return prev.filter((_, i) => i !== index);
    });
    setFieldError(null);
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!documentType) {
      setFieldError("Please select a document type.");
      setShowDocTypeMenu(false);
      return;
    }

    if (files.length === 0) {
      setFieldError("Please upload at least one document image.");
      return;
    }

    if (files.length > maxFiles) {
      setFieldError(
        `You can upload a maximum of ${maxFiles} document image${maxFiles === 1 ? "" : "s"}.`,
      );
      return;
    }

    setFieldError(null);
    const localFiles = files
      .filter(
        (file): file is Extract<VerificationFileItem, { kind: "local" }> =>
          file.kind === "local",
      )
      .map((file) => file.file);
    const existingUrls = files
      .filter(
        (file): file is Extract<VerificationFileItem, { kind: "uploaded" }> =>
          file.kind === "uploaded",
      )
      .map((file) => file.url);

    const result = await onSubmit({
      documentType,
      files: localFiles,
      existingUrls,
    });
    if (result !== false) {
      setStep("submitted");
    }
  };

  if (status === "APPROVED") {
    return (
      <main className="font-sf-pro-display flex flex-col min-h-full bg-white text-[#111827]">
        <div className="w-full max-w-[390px] mx-auto px-6 pt-[max(env(safe-area-inset-top),1.25rem)] pb-8">
          <div className="flex min-h-[72vh] flex-col items-center text-center">
            <div className="mt-8 h-24 w-24 rounded-full bg-[#14C3CF]/10 flex items-center justify-center">
              <div className="h-16 w-16 rounded-2xl border-2 border-[#14C3CF] flex items-center justify-center text-[#14C3CF]">
                <ShieldCheck size={42} strokeWidth={2.4} />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <h2 className="text-[22px] font-semibold">Identity Verified</h2>
              <p className="text-[12px] leading-5 text-[#8F98A0] max-w-[250px] mx-auto">
                Your identity has been successfully verified. You can now enjoy
                all the benefits of being a verified Cloak user.
              </p>
            </div>
            <div className="mt-8 w-full rounded-2xl border border-[#E8F3F4] bg-[#FAFEFE] p-4 text-left">
              <p className="mb-2 text-[13px] font-medium text-[#14C3CF]">
                You're now verified
              </p>
              {[
                "Verified badge on your profile",
                "Increased trust across the community",
                "Access to influencer-only features",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 border-b border-[#EDF2F4] py-3 last:border-b-0"
                >
                  <div className="h-7 w-7 rounded-full bg-[#14C3CF]/10 flex items-center justify-center">
                    <BadgeCheckIcon
                      size={16}
                      activeColor="#14C3CF"
                      isActive={true}
                    />
                  </div>
                  <span className="text-[12px] text-[#2D2D2D]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === "REJECTED") {
    return (
      <main className="font-sf-pro-display flex flex-col min-h-full bg-white text-[#111827]">
        <div className="w-full max-w-[390px] mx-auto px-6 pt-[max(env(safe-area-inset-top),1.25rem)] pb-8">
          <div className="flex min-h-[72vh] flex-col items-center text-center">
            <div className="mt-8 h-24 w-24 rounded-full bg-[#FF3B30]/10 flex items-center justify-center">
              <div className="h-16 w-16 rounded-2xl border-2 border-[#FF3B30] flex items-center justify-center text-[#FF3B30]">
                <svg
                  width="42"
                  height="42"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M8 8L16 16M16 8L8 16" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <h2 className="text-[22px] font-semibold">
                Verification Unsuccessful
              </h2>
              <p className="text-[12px] leading-5 text-[#8F98A0] max-w-[250px] mx-auto">
                We couldn't verify your identity using the submitted document.
              </p>
            </div>
            <div className="mt-8 w-full rounded-2xl border border-[#FFE5E5] bg-[#FFFBFB] p-4 text-left">
              <p className="mb-2 text-[13px] font-medium text-[#FF3B30]">
                Possible reasons
              </p>
              <ul className="list-disc space-y-2 pl-5 text-[12px] leading-5 text-[#2D2D2D]">
                <li>The document image is blurry or unclear</li>
                <li>Information couldn't be read properly</li>
                <li>The document may be expired</li>
                <li>The document doesn't match your account details</li>
              </ul>
            </div>
            <div className="mt-4 w-full rounded-2xl border border-[#F1EDED] bg-[#FFFBFB] p-4 text-left">
              <p className="mb-2 text-[13px] font-medium text-[#2D2D2D]">
                Need help?
              </p>
              <p className="text-[12px] leading-5 text-[#2D2D2D]">
                Please ensure your document is clear, valid, and fully visible
                before trying again.
              </p>
            </div>
            <div className="mt-auto w-full space-y-3 pt-8">
              <button
                onClick={onContinueToDashboard}
                className="w-full h-14 rounded-full bg-[#14C3CF] text-white font-medium text-[14px]"
              >
                Upload New Media
              </button>
              <button
                onClick={onSkip}
                className="w-full h-12 rounded-full bg-[#F5F5F5] text-[#A7ADB2] font-medium text-[13px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (step === "submitted") {
    return (
      <main className="font-sf-pro-display flex min-h-full flex-col overflow-x-hidden bg-[#F5F5F5] text-[#2D2D2D]">
        <div className="w-full max-w-[390px] mx-auto px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-10">
          <div className="flex flex-col items-start">
            {!hideHeader && (
              <div className="flex w-full items-center justify-between mb-9">
                <Image
                  src="/images/logo/cloakLogo.svg"
                  alt="Cloak logo"
                  width={34}
                  height={39}
                />
                <span className="text-[13px] font-semibold tracking-wider text-[#14C3CF]">
                  STEP 3/3
                </span>
              </div>
            )}

            <div className="mb-8 space-y-2 opacity-40">
              <h1 className="text-[24px] font-[600]">Verify Your Identity</h1>
              <p className="text-[14px]">
                Are you a public figure or notable individual?
              </p>
            </div>

            <div className="w-full space-y-4 flex-1">
              <div className="h-12 w-full rounded-xl bg-[#ECECEC] opacity-40" />
              <div className="h-24 w-full rounded-xl bg-[#ECECEC] opacity-40" />
            </div>

            <div className="w-full bg-white rounded-3xl p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] animate-in slide-in-from-bottom-10 duration-500">
              <h2 className="text-[18px] font-semibold mb-2">
                Identity Verification Request
              </h2>
              <p className="text-[14px] text-[#8F98A0] leading-relaxed mb-6">
                Your request to verify your Cloak account is now under review.
                You can expect to hear from us within 24 hours
              </p>
              <button
                onClick={onContinueToDashboard}
                className="w-full h-14 rounded-full bg-[#14C3CF] text-white font-medium text-[16px] shadow-[0_10px_24px_rgba(20,195,207,0.22)]"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="font-sf-pro-display flex min-h-full flex-col overflow-x-hidden bg-white text-[#2D2D2D]">
      <div className="w-full max-w-[390px] mx-auto px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-10 flex flex-col h-full">
        <div className="flex flex-col items-start flex-1 min-h-0">
          {!hideHeader && (
            <div className="flex w-full items-center justify-between mb-9 shrink-0">
              <Image
                src="/images/logo/cloakLogo.svg"
                alt="Cloak logo"
                width={34}
                height={39}
              />
              <span className="text-[13px] font-semibold tracking-wider text-[#14C3CF]">
                STEP 3/3
              </span>
            </div>
          )}

          <div className="mb-8 space-y-2 shrink-0">
            <h1 className="text-[24px] font-[600] leading-[1.2] tracking-[-0.03em] text-[#2D2D2D]">
              Verify Your Identity
            </h1>
            <p className="max-w-[280px] text-[14px] leading-6 text-[#8F98A0]">
              Are you a public figure or notable individual?
            </p>
          </div>

          <div className="w-full space-y-4 shrink-0">
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

          <div className="flex-1 min-h-0 w-full space-y-6 overflow-y-auto overflow-x-hidden pb-4">
            <div className="space-y-2.5">
              <label className="block text-[15px] font-medium text-[#3E454B]">
                Document type
              </label>
              <button
                onClick={() => setShowDocTypeMenu(true)}
                disabled={isLoading}
                className="flex h-14 w-full min-w-0 items-center justify-between rounded-[18px] bg-[#ECECEC] px-5 text-[15px] text-[#2D2D2D]"
              >
                <span
                  className={`min-w-0 flex-1 truncate pr-3 text-left ${
                    documentType ? "text-[#2D2D2D]" : "text-[#A7ADB2]"
                  }`}
                >
                  {documentType || "Select document type"}
                </span>
                <svg
                  width="12"
                  height="8"
                  viewBox="0 0 12 8"
                  fill="none"
                  className={`shrink-0 transition-transform ${
                    showDocTypeMenu ? "rotate-180" : ""
                  }`}
                >
                  <path
                    d="M1 1.5L6 6.5L11 1.5"
                    stroke="#14C3CF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <BottomSheet
                open={showDocTypeMenu}
                onClose={() => setShowDocTypeMenu(false)}
              >
                <div className="relative flex items-center justify-center px-6 pt-2">
                  <p className="text-[16px] font-semibold text-[#2D2D2D]">
                    Select document type to verify
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDocTypeMenu(false)}
                    className="absolute right-3 top-1 flex h-9 w-9 items-center justify-center rounded-full text-[#98A0A7]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-3 border-t border-[#E8E8E8]" />
                <div className="px-4 py-2 pb-6">
                  {DOCUMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setDocumentType(type);
                        setShowDocTypeMenu(false);
                        setFieldError(null);
                      }}
                      className="w-full rounded-xl px-4 py-3 text-left text-[15px] break-words hover:bg-[#F5F5F5] transition-colors"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </BottomSheet>
              {fieldError && (
                <p className="text-[12px] font-medium text-[#FF3B30]">
                  {fieldError}
                </p>
              )}
            </div>

            {/* 1. Files Preview List (Rendered first if files exist) */}
            {files.length > 0 && (
              <div className="grid grid-cols-1 gap-4 pb-4 sm:flex sm:overflow-x-auto sm:no-scrollbar sm:snap-x">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:w-[280px] sm:flex-none sm:snap-center"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="text-[#8F98A0]"
                        >
                          <path
                            d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#2D2D2D]">
                          {file.name}
                        </span>
                      </div>
                      <button
                        disabled={isLoading}
                        onClick={() => removeFile(idx)}
                        className="text-[#8F98A0] hover:text-[#FF3B30] p-1 transition-colors disabled:opacity-50"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M18 6L6 18M6 6L18 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                      <img
                        src={file.previewUrl}
                        alt={`Preview ${idx}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Add File Button & Explanatory Text (Moved beneath the previews) */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleAddFileClick}
                disabled={isLoading || files.length >= maxFiles}
                className={`w-full h-10 rounded-full border-2 flex items-center justify-center gap-2 text-[15px] font-medium transition-all ${
                  documentType && files.length < maxFiles
                    ? "border-[#00C3D0] bg-[#00C3D0] text-white"
                    : "border-[#839297] bg-[#839297] text-white"
                }`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18.125 16.875V6.7625C18.125 6.49717 18.0196 6.24293 17.8321 6.05546L12.3321 0.555456C12.1446 0.367991 11.8903 0.262695 11.625 0.262695H2.5V16.875C2.5 18.2557 3.61929 19.375 5 19.375H15.625C17.0057 19.375 18.125 18.2557 18.125 16.875ZM16.875 16.875C16.875 17.5654 16.3154 18.125 15.625 18.125H5C4.30964 18.125 3.75 17.5654 3.75 16.875V1.5127H11.25V7.5H16.875V16.875ZM12.5 2.39645L15.9906 5.8877H12.5V2.39645ZM5.625 6.25H8.125V5H5.625V6.25ZM5.625 10H14.375V8.75H5.625V10ZM5.625 13.75H14.375V12.5H5.625V13.75Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                </svg>
                Add File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="text-[12px] text-[#8F98A0]">
                {!documentType
                  ? "Select a document type to upload its image."
                  : files.length >= maxFiles
                    ? "Document image uploaded."
                    : "Upload 1 clear image of your document."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-[#14C3CF]/5 rounded-2xl border border-[#14C3CF]/10 shrink-0">
            <div className="flex-1">
              <p className="text-[12px] leading-relaxed text-[#2D2D2D]">
                Verified users get a badge , to let other users know that Cloak
                has verified their identity
              </p>
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F7F7F7]">
              <BadgeCheck size={20} fill="#14C3CF" className="text-white" />
            </div>
          </div>
          <div className="w-full pt-6 flex gap-3 shrink-0">
            {/* {showSkip && (
              <button onClick={onSkip} className="flex-1 h-14 rounded-full bg-[#ECECEC] text-[16px] font-medium text-[#2D2D2D]">
                Skip
              </button>
            )} */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={`${showSkip ? "flex-[1.5]" : "w-full"} h-12 rounded-full text-[18px] font-medium text-white shadow-lg transition-all ${
                documentType && files.length > 0
                  ? "bg-[#00C3D0] shadow-[0_10px_24px_rgba(20,195,207,0.22)] active:scale-[0.98]"
                  : "bg-[#839297] opacity-70 active:scale-[0.98]"
              }`}
            >
              {isLoading ? (
                <span className="inline-flex h-6 w-6 rounded-full border-4 border-white border-t-transparent animate-spin" />
              ) : (
                "Submit"
              )}
            </button>
          </div>
        </div>
      </div>

      <BottomSheet
        open={showGuidelineSheet}
        onClose={() => setShowGuidelineSheet(false)}
      >
        <div className="flex justify-end px-4 pt-1">
          <button
            type="button"
            onClick={() => setShowGuidelineSheet(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#98A0A7]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-8">
          <div className="relative w-full aspect-[4/3]">
            <Image
              src="/images/ID-card/Id-card.png"
              alt="Document photo guidelines"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}
