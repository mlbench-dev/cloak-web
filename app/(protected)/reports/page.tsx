"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import VerifiedBadge from "@/app/components/VerifiedBadge";

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
  const [activeFilter, setActiveFilter] = useState<
    "all" | "PENDING" | "APPROVED" | "FALSE_POSITIVE"
  >("all");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (reports.length === 0) {
      fetchReports();
    }
  }, [activeFilter]);

  const filteredReports =
    activeFilter === "all"
      ? reports
      : reports.filter((report) => {
          if (activeFilter === "APPROVED") {
            return report.status === "VERIFIED" || report.status === "APPROVED";
          }

          if (activeFilter === "FALSE_POSITIVE") {
            return (
              report.status === "FALSE_POSITIVE" || report.status === "REJECTED"
            );
          }

          return report.status === activeFilter;
        });

  const getFilterCount = (
    filter: "all" | "PENDING" | "APPROVED" | "FALSE_POSITIVE",
  ) => {
    if (filter === "all") return reports.length;

    if (filter === "APPROVED") {
      return reports.filter(
        (report) =>
          report.status === "VERIFIED" || report.status === "APPROVED",
      ).length;
    }

    if (filter === "FALSE_POSITIVE") {
      return reports.filter(
        (report) =>
          report.status === "FALSE_POSITIVE" || report.status === "REJECTED",
      ).length;
    }

    return reports.filter((report) => report.status === filter).length;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return "Just now";
  };

  const getPlatformImage = (platform: string) => {
    switch (platform) {
      case "instagram":
        return "/images/social-media/insta.svg";
      case "twitter":
      case "x":
        return "/images/social-media/twitter.svg";
      case "facebook":
        return "/images/social-media/facebook.svg";
      case "tiktok":
        return "/images/social-media/tiktok.svg";
      default:
        return "/images/social-media/insta.svg";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "text-[#14C3CF]";
      case "PENDING":
        return "text-[#F59E0B]";
      case "REJECTED":
      case "FALSE_POSITIVE":
        return "text-red-500";
      case "AI_VERIFIED":
        return "text-[#14C3CF]";
      default:
        return "text-[#8F98A0]";
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "VERIFIED" || status === "APPROVED") return "Approved";
    if (status === "PENDING") return "Pending";
    if (status === "FALSE_POSITIVE" || status === "REJECTED") return "Rejected";
    return status;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* <header className="shrink-0 flex items-center justify-between px-4 py-4 bg-white">
        <button onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-slate-600" />
        </button>
        <h2 className="text-xl font-bold text-[#2D2D2D]">Reports</h2>
        <div className="w-10"></div>
      </header> */}

      <header className="flex items-center justify-between  bg-white z-10">
        <button onClick={() => router.push("/dashboard")} className="p-2">
          <ChevronLeft className="h-6 w-6 text-slate-400" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">Reports</h1>
        <div className="w-10" />
      </header>

      {/* Filters */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All" },
            { key: "PENDING", label: "Pending" },
            { key: "APPROVED", label: "Approved" },
            { key: "FALSE_POSITIVE", label: "Rejected" },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() =>
                setActiveFilter(
                  filter.key as
                    | "all"
                    | "PENDING"
                    | "APPROVED"
                    | "FALSE_POSITIVE",
                )
              }
              className={`px-3 py-2.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === filter.key
                  ? "bg-[#14C3CF] text-white"
                  : "bg-[#F6F6F6] text-[#8F98A0]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#8F98A0]">
          Showing {getFilterCount(activeFilter)}{" "}
          {getFilterCount(activeFilter) === 1 ? "result" : "result's"}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-10 w-10 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin"></div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-8 text-[#8F98A0]">
            No reports found
          </div>
        ) : (
          filteredReports.map((report) => (
            <article
              key={report._id}
              onClick={() => router.push(`/reports/${report._id}`)}
              className="flex items-center gap-3 rounded-2xl bg-[#F6F6F6] px-3 py-3 cursor-pointer"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
                <Image
                  src={getPlatformImage(report.platform)}
                  alt={report.platform}
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {report.sourceLink}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <div
                    className="h-5 w-5 rounded-full bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${
                        report.user.profileImage ||
                        report.user.image ||
                        `https://i.pravatar.cc/100?u=${encodeURIComponent(
                          report.user.username,
                        )}`
                      })`,
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">
                      {report.user.username}
                    </span>
                    {report.user.identityVerificationStatus === "APPROVED" && (
                      <VerifiedBadge className="h-3.5 w-3.5 text-[#14C3CF]" />
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div
                  className={`text-xs font-medium ${getStatusColor(
                    report.status,
                  )}`}
                >
                  {getStatusLabel(report.status)}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {formatTimeAgo(report.createdAt)}
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
