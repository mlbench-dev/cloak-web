"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import VerificationStatusScreen from "@/app/components/verification/VerificationStatusScreen";

function normalizeVerificationStatus(status?: string | null) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  return null;
}

export default function VerificationPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const verificationStatus = useMemo(
    () =>
      normalizeVerificationStatus(
        searchParams.get("status") ||
          ((session?.user as any)?.identityVerificationStatus ?? null),
      ),
    [searchParams, session],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!verificationStatus) {
      router.replace("/profile");
    }
  }, [router, status, verificationStatus]);

  if (status === "loading" || !verificationStatus) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
      </div>
    );
  }

  return <VerificationStatusScreen status={verificationStatus} />;
}
