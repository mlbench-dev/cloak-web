"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";
import VerificationStatusScreen from "@/app/components/verification/VerificationStatusScreen";

function normalizeVerificationStatus(status?: string | null) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PENDING") return "PENDING";
  return null;
}

export default function VerificationPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verificationDetails, setVerificationDetails] = useState<{
    status?: string | null;
    verificationInProgress?: boolean;
    verificationFailureReason?: string | null;
    verificationResult?: {
      average_similarity?: number;
      threshold?: number;
      scores?: Record<string, number>;
      detail?: string;
      status?: string;
      verified?: boolean;
    } | null;
    verificationHistory?: Array<{
      status?: string | null;
      reason?: string | null;
    }>;
  } | null>(null);

  const queryStatus = useMemo(
    () => normalizeVerificationStatus(searchParams.get("status")),
    [searchParams],
  );

  const sessionStatus = useMemo(
    () =>
      normalizeVerificationStatus(
        ((session?.user as any)?.identityVerificationStatus ?? null) as any,
      ),
    [session],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!queryStatus && !sessionStatus) {
      router.replace("/profile");
    }
  }, [router, status, queryStatus, sessionStatus]);

  const hasFetchedVerificationDetails = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || hasFetchedVerificationDetails.current) {
      return;
    }
    hasFetchedVerificationDetails.current = true;

    const loadVerificationDetails = async () => {
      try {
        const response = await fetch("/api/auth/identity-verify");
        if (!response.ok) {
          return;
        }
        const data = await response.json().catch(() => null);
        setVerificationDetails({
          status: data?.status ?? null,
          verificationInProgress: Boolean(data?.verificationInProgress),
          verificationFailureReason: data?.verificationFailureReason ?? null,
          verificationResult: data?.verificationResult ?? null,
          verificationHistory: Array.isArray(data?.verificationHistory)
            ? data.verificationHistory
            : [],
        });
      } catch {
        // Ignore non-critical fetch failures and keep the generic message.
      }
    };

    void loadVerificationDetails();
  }, [status]);

  const effectiveStatus = useMemo(() => {
    return (
      queryStatus ||
      normalizeVerificationStatus(verificationDetails?.status ?? null) ||
      sessionStatus
    );
  }, [queryStatus, verificationDetails?.status, sessionStatus]);

  const isVerificationInProgress =
    effectiveStatus === "PENDING" &&
    Boolean(verificationDetails?.verificationInProgress);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      effectiveStatus !== "PENDING" ||
      verificationDetails === null
    ) {
      return;
    }

    if (!verificationDetails?.verificationInProgress) {
      router.replace("/profile");
    }
  }, [router, status, effectiveStatus, verificationDetails]);

  if (
    status === "loading" ||
    !effectiveStatus ||
    (effectiveStatus === "PENDING" && verificationDetails === null)
  ) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
      </div>
    );
  }

  if (isVerificationInProgress) {
    return (
      <main className="min-h-full bg-white font-sf-pro-display text-[#111111]">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),16px)]">
          <header className="flex items-center justify-between  bg-white z-10">
            <button
              onClick={() => {
                router.push("/profile");
              }}
              className="p-2"
            >
              <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
            </button>
            <h1 className="text-lg font-semibold text-[#2D2D2D]">
              Verification
            </h1>
            <div className="w-10" />
          </header>
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
            <h2 className="mt-6 text-[22px] font-semibold text-[#161616]">
              We are verifying your identity
            </h2>
            <p className="mt-2 max-w-[320px] text-[14px] leading-7 text-[#9DA3AE]">
              Please wait. We will update your verification status soon. Check
              your Profile after some time.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const finalStatus =
    effectiveStatus === "APPROVED" || effectiveStatus === "REJECTED"
      ? effectiveStatus
      : null;

  if (!finalStatus) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
      </div>
    );
  }

  return (
    <VerificationStatusScreen
      status={finalStatus}
      failureReason={verificationDetails?.verificationFailureReason}
      verificationResult={verificationDetails?.verificationResult}
      verificationHistory={verificationDetails?.verificationHistory}
    />
  );
}
