"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, BadgeCheck } from "lucide-react";
import Image from "next/image";

type ReportDetails = {
  _id: string;
  platform: string;
  sourceLink: string;
  status: string;
  aiConfidence: number;
  reportedBy: {
    username: string;
    name?: string;
    image?: string;
    profileImage?: string;
    level: number;
  };
};

export default function ReportDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [report, setReport] = useState<ReportDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        // First fetch all received reports to find the one with this id
        const res = await fetch("/api/reports?type=received");
        const data = await res.json();
        if (data.success) {
          const found = data.reports.find((r: any) => r._id === id);
          if (found) {
            setReport({
              ...found,
              reportedBy: found.user,
            });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!report) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/reports/${report._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setShowModal(status);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center">
        <p className="text-[#8F98A0]">Report not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-[#14C3CF] font-medium"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* <header className="shrink-0 flex items-center justify-between px-4 py-4 bg-white">
        <button onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-slate-600" />
        </button>
        <h2 className="text-xl font-bold text-[#2D2D2D]">Report Details</h2>
        <div className="w-10"></div>
      </header> */}

      <header className="flex items-center justify-between  bg-white z-10">
        <button onClick={() => router.push("/reports")} className="p-2">
          <ChevronLeft className="h-6 w-6 text-slate-400" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">Report Detail</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-6">
        {/* Reported by */}
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${
                report.reportedBy.profileImage ||
                report.reportedBy.image ||
                `https://i.pravatar.cc/100?u=${encodeURIComponent(
                  report.reportedBy.username,
                )}`
              })`,
            }}
          />
          <div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#2D2D2D]">
                {report.reportedBy.username}
              </span>
              <BadgeCheck className="h-4 w-4 text-[#14C3CF]" />
            </div>
            <p className="text-sm text-[#8F98A0]">
              Level {report.reportedBy.level}
            </p>
          </div>
        </div>

        {/* Source link */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[#8F98A0]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <Image
                src={getPlatformImage(report.platform)}
                alt={report.platform}
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
            <span>Source Link</span>
          </div>
          <a
            href={report.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-[#14C3CF]"
          >
            {report.sourceLink}
          </a>
        </div>

        {/* Link preview placeholder */}
        <div className="aspect-video rounded-2xl bg-[#F6F6F6] flex items-center justify-center">
          <span className="text-[#8F98A0]">Link Preview</span>
        </div>

        {/* AI Confidence */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#2D2D2D]">
              AI Confidence Match
            </span>
            <span className="text-sm font-medium text-[#14C3CF]">
              {report.aiConfidence}%
            </span>
          </div>
          <div className="h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#14C3CF]"
              style={{ width: `${report.aiConfidence}%` }}
            />
          </div>
        </div>

        {/* Action buttons */}
        {report.status === "PENDING" && (
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              onClick={() => updateStatus("FALSE_POSITIVE")}
              disabled={updating}
              className="h-14 rounded-full bg-[#F2F2F2] px-4 text-[15px] font-medium text-[#8F98A0] disabled:opacity-60"
            >
              Mark as False Positive
            </button>
            <button
              onClick={() => updateStatus("VERIFIED")}
              disabled={updating}
              className="h-14 rounded-full bg-[#14C3CF] px-4 text-[15px] font-medium text-white disabled:opacity-60"
            >
              Verify Report
            </button>
          </div>
        )}

        {report.status !== "PENDING" && (
          <div className="flex justify-center pt-4">
            <div
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                report.status === "VERIFIED" || report.status === "APPROVED"
                  ? "bg-[#E7FAFC] text-[#14C3CF]"
                  : "bg-red-50 text-red-500"
              }`}
            >
              {report.status === "VERIFIED" || report.status === "APPROVED"
                ? "Approved"
                : "Rejected"}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-6 mx-4 max-w-sm w-full space-y-4">
            {showModal === "VERIFIED" ? (
              <>
                <div className="text-center">
                  <div className="h-16 w-16 bg-[#E7FAFC] rounded-full flex items-center justify-center mx-auto mb-4">
                    <BadgeCheck className="h-8 w-8 text-[#14C3CF]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#2D2D2D]">
                    Report Approved
                  </h3>
                  <p className="text-[#8F98A0] mt-2">
                    10 points have been rewarded to {report.reportedBy.username}
                  </p>
                  <p className="text-[#8F98A0] mt-1">
                    We're happy that platform is helping you stay protected
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(null);
                    router.push("/reports");
                  }}
                  className="w-full py-3 rounded-2xl bg-[#14C3CF] text-white font-medium"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="h-16 w-16 bg-[#F6F6F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="h-8 w-8 text-[#8F98A0]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#2D2D2D]">
                    Report Rejected
                  </h3>
                  <p className="text-[#8F98A0] mt-2">
                    This report was marked as rejected
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(null);
                    router.push("/reports");
                  }}
                  className="w-full py-3 rounded-2xl bg-[#14C3CF] text-white font-medium"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
