"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import VerifiedBadge from "@/app/components/VerifiedBadge";

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

const statusFilters = [
  { id: "all", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "FALSE_POSITIVE", label: "Rejected" },
];

export default function MyReportsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>("all");
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

  const filteredReports =
    activeFilter === "all"
      ? allReports
      : allReports.filter((report) => {
          if (activeFilter === "APPROVED") {
            return report.status === "VERIFIED" || report.status === "APPROVED";
          }

          if (activeFilter === "FALSE_POSITIVE") {
            return (
              report.status === "REJECTED" || report.status === "FALSE_POSITIVE"
            );
          }

          return report.status === activeFilter;
        });

  const getStatusCount = (statusId: string) => {
    if (statusId === "all") return allReports.length;

    if (statusId === "APPROVED") {
      return allReports.filter(
        (report) =>
          report.status === "VERIFIED" || report.status === "APPROVED",
      ).length;
    }
    if (statusId === "FALSE_POSITIVE") {
      return allReports.filter(
        (report) =>
          report.status === "REJECTED" || report.status === "FALSE_POSITIVE",
      ).length;
    }

    return allReports.filter((report) => report.status === statusId).length;
  };

  const getStatusPresentation = (status: ReportStatus) => {
    if (status === "VERIFIED" || status === "APPROVED") {
      return { label: "Approved", color: "#14C3CF" };
    }

    if (status === "REJECTED" || status === "FALSE_POSITIVE") {
      return { label: "Rejected", color: "#EF4444" };
    }

    return { label: "Pending", color: "#F59E0B" };
  };

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
        <button onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">My Reports</h1>
        <div className="w-10" />
      </header>

      {/* Status filters */}
      <div className="shrink-0 bg-white px-4 py-3">
        <div className="flex flex-nowrap gap-1.5">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`flex-1 whitespace-nowrap px-2 py-2 rounded-full text-xs xs:text-sm font-medium text-center transition-all ${
                activeFilter === filter.id
                  ? "bg-[#14C3CF] text-white"
                  : "bg-[#F5F5F5] text-[#666666]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#8F98A0]">
          Showing {getStatusCount(activeFilter)}{" "}
          {getStatusCount(activeFilter) === 1 ? "result" : "results"}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center pt-10">
            <div className="h-8 w-8 border-3 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <p className="text-[#8F98A0] text-base">No reports yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReports.map((report) => (
              <div
                key={report._id}
                onClick={() => router.push(`/reports/${report._id}?type=sent`)}
                className="flex cursor-pointer items-center justify-between rounded-2xl px-3 py-4 bg-[#F7F7F8] hover:bg-[#EDEEF0] active:bg-[#E4E5E8] transition-colors duration-150"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                    {report.user.image || report.user.profileImage ? (
                      <img
                        src={report.user.image || report.user.profileImage}
                        alt={report.user.username || report.user.name || "User"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-6 w-6 bg-slate-400 rounded-full" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-[#2D2D2D] font-semibold text-base">
                        {report.user.username}
                      </p>
                      {report.user.identityVerificationStatus ===
                        "APPROVED" && (
                        <VerifiedBadge className="h-4 w-4 text-[#14C3CF]" />
                      )}
                    </div>
                    <p className="text-[#8F98A0] text-sm">
                      {report.user.name?.trim() || report.user.username}
                    </p>
                  </div>
                </div>
                <p
                  className="text-sm font-medium"
                  style={{ color: getStatusPresentation(report.status).color }}
                >
                  {getStatusPresentation(report.status).label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
