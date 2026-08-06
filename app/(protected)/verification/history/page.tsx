"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";
import { formatVerificationReason } from "@/app/components/verification/VerificationStatusScreen";

type HistoryEntry = {
  status?: string | null;
  reason?: string | null;
};

export default function VerificationHistoryPage() {
  const router = useRouter();
  const { status } = useSession();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || hasFetched.current) return;
    hasFetched.current = true;

    const loadHistory = async () => {
      try {
        const response = await fetch("/api/auth/identity-verify");
        const data = await response.json().catch(() => null);
        setHistory(
          Array.isArray(data?.verificationHistory)
            ? data.verificationHistory
            : [],
        );
      } catch (error) {
        console.error("Failed to load verification history", error);
      } finally {
        setLoading(false);
      }
    };

    void loadHistory();
  }, [status]);

  const entries = history.filter((entry) => entry?.status || entry?.reason);

  return (
    <main className="min-h-full bg-white font-sf-pro-display text-[#111111]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),16px)]">
        <header className="flex items-center justify-between  bg-white z-10">
          <button type="button" onClick={() => router.back()} className="p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-lg font-semibold text-[#2D2D2D]">
            Verification History
          </h1>
          <div className="w-10" />
        </header>

        <div className="flex-1 pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-[14px] text-[#98A0A7]">
              No verification history yet.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div
                  key={`${entry.status || "unknown"}-${entry.reason || "no-reason"}-${index}`}
                  className="rounded-[18px] border border-[#EBF1F2] bg-[#FCFEFE] px-4 py-3"
                >
                  <p
                    className={`text-[14px] font-semibold ${
                      String(entry.status).toUpperCase() === "APPROVED"
                        ? "text-[#16C2CE]"
                        : "text-[#F04B43]"
                    }`}
                  >
                    {String(entry.status).toUpperCase() === "APPROVED"
                      ? "Approved"
                      : "Rejected"}
                  </p>
                  {entry.reason ? (
                    <p className="mt-1 text-[14px] leading-6 text-[#5F6670]">
                      {formatVerificationReason(entry.reason)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
