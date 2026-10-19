"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { goBack } from "@/lib/navigation";
import { ChevronLeft } from "lucide-react";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import {
  ReportFilterPills,
  ReportRowMeta,
  matchesReportFilter,
  type ReportFilter,
} from "@/app/components/reports/reportUi";

type ReportStatus =
  | "PENDING"
  | "APPROVED"
  | "VERIFIED"
  | "REJECTED"
  | "FALSE_POSITIVE";

type Report = {
  _id: string;
  reportedBy: string;
  targetUserId: string;
  sourceLink: string;
  platform: string;
  notes?: string;
  status: ReportStatus;
  createdAt: string;
  user: {
    _id: string;
    username?: string;
    name?: string;
    image?: string;
    profileImage?: string;
    identityVerificationStatus?: string;
  };
};

const truncateText = (text: string, maxChars: number) =>
  text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}...` : text;

export default function MyReportsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<ReportFilter>("all");
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const hasFetchedReports = useRef(false);

  useEffect(() => {
    if (status === "authenticated" && !hasFetchedReports.current) {
      hasFetchedReports.current = true;
      fetchReports();
    }
  }, [status]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=sent&status=all`);
      const data = await res.json();
      if (data.success) {
        setAllReports(data.reports);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = allReports.filter((report) =>
    matchesReportFilter(report.status, activeFilter),
  );
  const getStatusCount = (filter: ReportFilter) =>
    allReports.filter((report) => matchesReportFilter(report.status, filter))
      .length;

  const totalReports = allReports.length;
  const verifiedReports = getStatusCount("VERIFIED");
  const rejectedReports = getStatusCount("REJECTED");
  // Accuracy only counts reports that have been reviewed — pending ones
  // haven't been judged right or wrong yet.
  const reviewedReports = verifiedReports + rejectedReports;
  const accuracy =
    reviewedReports > 0
      ? `${Math.round((verifiedReports / reviewedReports) * 100)}%`
      : "—";

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between  bg-white z-10">
        <button
          type="button"
          // Opened from Submit Report or Profile — go back to whichever it
          // was; fall back to Profile when there's no history (direct link).
          onClick={() => goBack(router, "/profile")}
          className="-ml-3 p-2"
        >
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">My Reports</h1>
        <div className="-mr-3 w-10" />
      </header>

      <div className="mt-4 grid shrink-0 grid-cols-3 rounded-2xl bg-[#F5F5F5] py-3">
        {[
          { label: "Reports", value: totalReports },
          { label: "Verified", value: verifiedReports },
          { label: "Accuracy", value: accuracy },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center gap-1 ${
              index > 0 ? "border-l border-[#E2E2E2]" : ""
            }`}
          >
            <p className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
              {stat.value}
            </p>
            <p className="text-[12px] leading-4 text-[#A7ADB2]">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="shrink-0 bg-white py-3">
        <ReportFilterPills
          active={activeFilter}
          onChange={setActiveFilter}
          getCount={getStatusCount}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {loading ? (
          <div className="flex items-center justify-center pt-10">
            <div className="h-8 w-8 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <p className="text-[#8F98A0] text-[12px]">No reports yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredReports.map((report) => (
              <div
                key={report._id}
                onClick={() => router.push(`/reports/${report._id}?type=sent`)}
                className="flex cursor-pointer items-center gap-3 rounded-2xl py-2 transition-colors duration-150 hover:bg-[#F7F7F8] active:bg-[#EDEEF0]"
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-200">
                  <img
                    src={
                      report.user.image ||
                      report.user.profileImage ||
                      "/images/placeholder_avatar.png"
                    }
                    alt={report.user.username || report.user.name || "User"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-[16px] leading-[22px] text-[#2B2B2B]">
                      {report.user.username}
                    </p>
                    {report.user.identityVerificationStatus === "APPROVED" && (
                      <VerifiedBadge className="h-4 w-4 shrink-0 text-[#14C3CF]" />
                    )}
                  </div>
                  <p className="truncate text-[12px] leading-4 text-[#8F98A0]">
                    {truncateText(
                      report.user.name || report.user.username || "",
                      30,
                    )}
                  </p>
                </div>
                <ReportRowMeta
                  status={report.status}
                  createdAt={report.createdAt}
                  platform={report.platform}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
