"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  PlatformCircle,
  ReportFilterPills,
  ReportRowMeta,
  getSourceDomain,
  matchesReportFilter,
  type ReportFilter,
} from "@/app/components/reports/reportUi";

type ReportItem = {
  _id: string;
  platform: string;
  sourceLink: string;
  user: {
    username: string;
    name?: string;
    image?: string;
    profileImage?: string;
    identityVerificationStatus?: string;
  };
  status: string;
  createdAt: string;
};

export default function ReportsPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<ReportFilter>("all");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedReports = useRef(false);

  const fetchReports = async () => {
    try {
      const params = new URLSearchParams({
        type: "received",
        status: "all",
      });
      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetchedReports.current) return;
    hasFetchedReports.current = true;
    fetchReports();
  }, []);

  const filteredReports = reports.filter((report) =>
    matchesReportFilter(report.status, activeFilter),
  );
  const getFilterCount = (filter: ReportFilter) =>
    reports.filter((report) => matchesReportFilter(report.status, filter))
      .length;

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between  bg-white z-10">
        <button onClick={() => router.push("/dashboard")} className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Reports</h1>
        <div className="-mr-3 w-10" />
      </header>

      <div className="shrink-0 bg-white pb-3 pt-4">
        <ReportFilterPills
          active={activeFilter}
          onChange={setActiveFilter}
          getCount={getFilterCount}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {loading ? (
          <div className="flex items-center justify-center pt-10">
            <div className="h-8 w-8 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <p className="text-[12px] text-[#8F98A0]">No reports yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredReports.map((report) => (
              <div
                key={report._id}
                onClick={() => router.push(`/reports/${report._id}`)}
                className="flex cursor-pointer items-center gap-3 rounded-2xl py-2 transition-colors duration-150 hover:bg-[#F7F7F8] active:bg-[#EDEEF0]"
              >
                <PlatformCircle platform={report.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] leading-[22px] text-[#2B2B2B]">
                    {getSourceDomain(report.sourceLink)}
                  </p>
                  <p className="truncate text-[12px] leading-4 text-[#8F98A0]">
                    {report.user.name?.trim() || report.user.username}
                  </p>
                </div>
                <ReportRowMeta
                  status={report.status}
                  createdAt={report.createdAt}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
