"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IncidentStatusPill, PlatformIcon } from "./_components/IncidentUI";
import { INCIDENT_STATUS_TABS, MOCK_INCIDENTS } from "./_lib/incidents";

export default function IncidentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof INCIDENT_STATUS_TABS)[number]>("All");

  const incidents =
    activeTab === "All"
      ? MOCK_INCIDENTS
      : MOCK_INCIDENTS.filter((incident) => incident.status === activeTab);

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between  bg-white z-10">
        <button type="button" onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">Incidents</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto py-3 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
            {INCIDENT_STATUS_TABS.map((tabValue) => {
              const isActive = activeTab === tabValue;
              return (
                <button
                  key={tabValue}
                  type="button"
                  onClick={() => setActiveTab(tabValue)}
                  className={`h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-all ${
                    isActive ? "bg-[#14C3CF] text-white" : "bg-[#F3F3F3] text-[#4B4B4B]"
                  }`}
                >
                  {tabValue}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {incidents.length > 0 ? (
            incidents.map((incident) => (
              <Link key={incident.id} href={`/incidents/${incident.id}`} className="block">
                <div className="flex items-center gap-3 rounded-2xl bg-[#F5F5F5] px-3.5 py-3">
                  <PlatformIcon platform={incident.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[#2D2D2D]">
                      {incident.urlLabel}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#8F98A0]">
                      Detected {incident.detectedAgo} • {incident.matchPercent}% match
                    </p>
                  </div>
                  <IncidentStatusPill status={incident.status} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#B5BEC4]" />
                </div>
              </Link>
            ))
          ) : (
            <p className="py-10 text-center text-[13px] text-[#8F98A0]">No incidents here</p>
          )}
        </div>
      </main>
    </div>
  );
}
