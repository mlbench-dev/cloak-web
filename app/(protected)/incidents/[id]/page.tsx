"use client";

import { Check, ChevronLeft, X as XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { IncidentStatusPill, PlatformIcon } from "../_components/IncidentUI";
import { getIncidentById, setIncidentStatus } from "../_lib/incidents";

const REJECTION_REASONS = [
  "Not me",
  "Incorrect context",
  "Poor image match",
  "Other",
] as const;

type ResultView = "detail" | "confirmed" | "reject-reason";

function ResultHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between px-4 py-4 bg-white z-10">
      {children}
      <div className="w-10" />
    </header>
  );
}

export default function IncidentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const incident = getIncidentById(params.id);
  const [view, setView] = useState<ResultView>("detail");
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_REASONS[0]);

  if (!incident) {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <ResultHeader>
          <button type="button" onClick={() => router.back()} className="p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-lg font-semibold text-[#2D2D2D]">Incident Details</h1>
        </ResultHeader>
        <div className="flex flex-1 items-center justify-center text-[14px] text-[#8F98A0]">
          Incident not found
        </div>
      </div>
    );
  }

  // No real backend yet for incidents (see the Phase 2.0 plan — mock data
  // only, same scope as the rest of this dashboard redesign). setIncidentStatus
  // writes into the shared MOCK_INCIDENTS array by id (not the render-scoped
  // `incident` reference) so it stays out of React Compiler's render-purity
  // checks. Navigating back to the list or Dashboard re-reads the same array
  // and reflects it. Wire this to the unified reports collection
  // (source: "AI_DISCOVERY") once that exists.
  const handleConfirm = () => {
    setIncidentStatus(incident.id, "Confirmed");
    setView("confirmed");
  };

  const handleReject = () => {
    setIncidentStatus(incident.id, "Rejected");
    setView("reject-reason");
  };

  if (view === "confirmed") {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <ResultHeader>
          <button type="button" onClick={() => router.push("/incidents")} className="p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
        </ResultHeader>

        <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#E8FEFF]">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-[#14C3CF]">
              <Check className="h-10 w-10 text-[#14C3CF]" strokeWidth={3} />
            </div>
          </div>

          <h1 className="mt-6 text-center text-[24px] font-semibold text-[#2D2D2D]">
            Match Confirmed
          </h1>
          <p className="mx-auto mt-2 max-w-[280px] text-center text-[14px] leading-6 text-[#8F98A0]">
            This incident has been confirmed as a match to your identity.
          </p>

          <div className="mt-8 rounded-2xl border border-[#F0F0F0]">
            <div className="flex items-center gap-3 border-b border-[#F0F0F0] p-4">
              <PlatformIcon platform={incident.platform} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-[#2D2D2D]">
                  {incident.urlLabel}
                </p>
                <p className="mt-0.5 text-[13px] text-[#8F98A0]">
                  {incident.matchPercent}% match
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-[#F0F0F0] px-4 py-3.5">
              <div>
                <p className="text-[13px] text-[#8F98A0]">Detected</p>
                <p className="mt-0.5 text-[15px] font-semibold text-[#2D2D2D]">
                  {incident.detectedAt}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-[13px] text-[#8F98A0]">Discovery Method</p>
                <p className="mt-0.5 text-[15px] font-semibold text-[#2D2D2D]">
                  {incident.discoveryMethod}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-3">
            <Link
              href="/submit-report"
              className="flex h-14 w-full items-center justify-center rounded-full bg-[#14C3CF] text-[15px] font-medium text-white"
            >
              Start Reporting
            </Link>
            <button
              type="button"
              onClick={() => router.push("/incidents")}
              className="h-14 w-full rounded-full border-2 border-[#14C3CF] bg-white text-[15px] font-medium text-[#14C3CF]"
            >
              Done
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (view === "reject-reason") {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <ResultHeader>
          <button type="button" onClick={() => setView("detail")} className="p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
        </ResultHeader>

        <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#FFEEEE]">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-[#EF4444]">
              <XIcon className="h-10 w-10 text-[#EF4444]" strokeWidth={3} />
            </div>
          </div>

          <h1 className="mt-6 text-center text-[24px] font-semibold text-[#2D2D2D]">
            Match Rejected
          </h1>
          <p className="mx-auto mt-2 max-w-[280px] text-center text-[14px] leading-6 text-[#8F98A0]">
            This incident has been marked as not related to your identity.
          </p>

          <div className="mt-8 rounded-2xl border border-[#F0F0F0]">
            <p className="px-4 pt-4 text-[15px] font-semibold text-[#2D2D2D]">
              Why are you rejecting this match?
            </p>
            <div className="mt-2">
              {REJECTION_REASONS.map((reason, index) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectionReason(reason)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${
                    index < REJECTION_REASONS.length - 1
                      ? "border-b border-[#F0F0F0]"
                      : ""
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      rejectionReason === reason
                        ? "border-[#14C3CF]"
                        : "border-[#D8D8D8]"
                    }`}
                  >
                    {rejectionReason === reason && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#14C3CF]" />
                    )}
                  </span>
                  <span className="text-[15px] text-[#2D2D2D]">{reason}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <button
              type="button"
              onClick={() => router.push("/incidents")}
              className="h-14 w-full rounded-full bg-[#EF4444] text-[15px] font-medium text-white"
            >
              Confirm Rejection
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <ResultHeader>
        <button type="button" onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">Incident Details</h1>
      </ResultHeader>

      <main className="flex-1 min-h-0 overflow-y-auto py-4 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex items-center gap-3 pb-4">
          <PlatformIcon platform={incident.platform} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-medium text-[#2D2D2D]">{incident.platformLabel}</p>
            <p className="mt-0.5 text-[13px] text-[#8F98A0]">Detected {incident.detectedAgo}</p>
          </div>
          <IncidentStatusPill status={incident.status} />
        </div>
        <div className="border-t border-[#F0F0F0]" />

        <div className="mt-5 rounded-[20px] bg-[#E8FEFF] p-5">
          <p className="text-[13px] text-[#8F98A0]">Match Confidence</p>
          <p className="mt-1 text-[20px] font-semibold text-[#2D2D2D]">
            {incident.matchPercent}% Match
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#14C3CF]"
              style={{ width: `${incident.matchPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#2D2D2D]">Source URL</p>
            <p className="mt-1 truncate text-[13px] text-[#8F98A0]">{incident.urlLabel}</p>
          </div>
          <Link
            href={incident.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[13px] font-medium text-[#14C3CF]"
          >
            Open Source
          </Link>
        </div>

        <div className="mt-6">
          <p className="text-[15px] font-semibold text-[#2D2D2D]">Evidence</p>
          <div className="relative mt-3 h-56 w-full overflow-hidden rounded-2xl bg-gray-100">
            <Image
              src={incident.evidenceImageUrl}
              alt="Evidence"
              fill
              className="object-cover"
            />
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-[#F0F0F0] p-4">
          <p className="text-[15px] font-semibold text-[#2D2D2D]">Detection Information</p>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#8F98A0]">Detected</p>
            <p className="text-[13px] font-medium text-[#2D2D2D]">{incident.detectedAt}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#8F98A0]">Discovery Method</p>
            <p className="text-[13px] font-medium text-[#2D2D2D]">{incident.discoveryMethod}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#8F98A0]">Source</p>
            <p className="text-[13px] font-medium text-[#2D2D2D]">{incident.platformLabel}</p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            className="h-14 flex-1 rounded-full bg-[#14C3CF] text-[15px] font-medium text-white"
          >
            Confirm Match
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="h-14 flex-1 rounded-full bg-[#FDE8E8] text-[15px] font-medium text-[#D14343]"
          >
            Reject Match
          </button>
        </div>
      </main>
    </div>
  );
}
