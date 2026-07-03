"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, X, Check, MessageCircle, ChevronLeft } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";

type Platform = "tiktok" | "instagram" | "facebook" | "twitter" | "other";
type User = {
  _id: string;
  username?: string;
  name?: string;
  image?: string;
  profileImage?: string;
  identityVerificationStatus?: string;
};

type RecentSearch = {
  _id: string;
  targetUser: User;
};

const platforms = [
  {
    id: "tiktok",
    label: "TikTok",
    icon: (
      <Image
        src="/images/social-media/tiktok.svg"
        alt="TikTok"
        width={24}
        height={24}
      />
    ),
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: (
      <Image
        src="/images/social-media/insta.svg"
        alt="Instagram"
        width={24}
        height={24}
      />
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: (
      <Image
        src="/images/social-media/facebook.svg"
        alt="Facebook"
        width={24}
        height={24}
      />
    ),
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    icon: (
      <Image
        src="/images/social-media/twitter.svg"
        alt="Twitter"
        width={24}
        height={24}
      />
    ),
  },
  {
    id: "other",
    label: "Other",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
];

function detectPlatform(link: string): Platform {
  const lowerLink = link.toLowerCase();
  if (lowerLink.includes("tiktok.com")) return "tiktok";
  if (lowerLink.includes("instagram.com")) return "instagram";
  if (lowerLink.includes("facebook.com") || lowerLink.includes("fb.com"))
    return "facebook";
  if (lowerLink.includes("twitter.com") || lowerLink.includes("x.com"))
    return "twitter";
  return "other";
}

export default function SubmitReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: select target user, 2: enter details
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sourceLink, setSourceLink] = useState("");
  const [platform, setPlatform] = useState<Platform>("other");
  const [notes, setNotes] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch recent searches on load
  useEffect(() => {
    if (status === "authenticated") {
      fetchRecentSearches();
    }
  }, [status]);

  const fetchRecentSearches = async () => {
    try {
      const res = await fetch("/api/reports?type=recent-searches");
      const data = await res.json();
      if (data.success) {
        setRecentSearches(data.searches);
      }
    } catch (error) {
      console.error("Error fetching recent searches:", error);
    }
  };

  const deleteRecentSearch = async (searchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/reports?searchId=${searchId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRecentSearches((prev) => prev.filter((s) => s._id !== searchId));
        toast.success("Search removed");
      }
    } catch (error) {
      console.error("Error deleting recent search:", error);
      toast.error("Failed to remove search");
    }
  };

  // Search users
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery)}`,
        );
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.users);
        }
      } catch (error) {
        console.error("Error searching users:", error);
      }
    }, 300);
  }, [searchQuery]);

  // Detect platform when source link changes
  useEffect(() => {
    if (sourceLink.trim()) {
      setPlatform(detectPlatform(sourceLink));
    }
  }, [sourceLink]);

  const handleSubmitReport = async () => {
    if (!selectedUser || !sourceLink) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: selectedUser._id,
          sourceLink,
          platform,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Report submitted successfully!");
        router.push("/profile");
      } else {
        toast.error(data.error || "Failed to submit report");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {step === 1 ? (
        <>
          <header className="shrink-0 flex items-center justify-between py-4 px-4 bg-white">
            <h1 className="text-2xl font-bold text-[#2D2D2D]">Submit Report</h1>
            <button
              onClick={() => router.push("/my-reports")}
              className="px-4 py-2 bg-[#14C3CF] text-white rounded-full text-sm font-medium"
            >
              My Reports
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
            <div className="mb-6">
              <p className="text-[#2D2D2D] text-[15px] font-medium mb-3">
                Target User
              </p>

              {/* Search input */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search target user via username"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-12 outline-none focus:ring-2 focus:ring-[#14C3CF]/20 text-base placeholder:text-[14px] placeholder:text-[#8F98A0]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                  >
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Recent searches - now below input */}
              {recentSearches.length > 0 && !searchQuery && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[#2D2D2D] text-[15px] font-medium">
                      Recent Searches
                    </p>
                    <button className="text-[#8F98A0] text-sm">
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {recentSearches
                      .filter((search) => search.targetUser)
                      .map((search) => (
                        <div
                          key={search._id}
                          onClick={() => {
                            setSelectedUser(search.targetUser);
                            setStep(2);
                          }}
                          className="cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                              {search.targetUser?.image ||
                              search.targetUser?.profileImage ? (
                                <img
                                  src={
                                    search.targetUser.image ||
                                    search.targetUser.profileImage
                                  }
                                  alt={
                                    search.targetUser.username ||
                                    search.targetUser.name ||
                                    "User"
                                  }
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-6 w-6 bg-slate-400 rounded-full" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1">
                                <p className="text-[#2D2D2D] font-semibold text-base">
                                  {search.targetUser.username || "User"}
                                </p>
                                {search.targetUser
                                  .identityVerificationStatus ===
                                  "APPROVED" && (
                                  <Check className="h-4 w-4 text-[#14C3CF]" />
                                )}
                              </div>
                              <p className="text-[#8F98A0] text-sm">
                                {search.targetUser.name || ""}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => deleteRecentSearch(search._id, e)}
                            className="p-2 hover:bg-slate-100 rounded-full"
                          >
                            <X className="h-5 w-5 text-slate-400" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user._id}
                      onClick={() => {
                        setSelectedUser(user);
                        setStep(2);
                      }}
                      className="p-4 bg-[#F5F5F5] rounded-2xl cursor-pointer hover:bg-[#EBEBEB] transition-colors flex items-center"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                          {user.image || user.profileImage ? (
                            <img
                              src={user.image || user.profileImage}
                              alt={user.username || user.name || "User"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-6 w-6 bg-slate-400 rounded-full" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1">
                            <p className="text-[#2D2D2D] font-semibold text-base">
                              {user.username || "User"}
                            </p>
                            {user.identityVerificationStatus === "APPROVED" && (
                              <Check className="h-4 w-4 text-[#14C3CF]" />
                            )}
                          </div>
                          <p className="text-[#8F98A0] text-sm">
                            {user.name || ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <header className="shrink-0 flex items-center justify-center py-4 px-4 bg-white">
            <h1 className="text-2xl font-bold text-[#2D2D2D]">Submit Report</h1>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
            <p className="text-[#666666] text-lg mb-6">
              Fill in the details below
            </p>

            {/* Selected target user */}
            {selectedUser && (
              <div className="mb-6">
                <p className="text-[#2D2D2D] text-[15px] font-medium mb-3">
                  Target User
                </p>
                <div className="p-4 bg-[#F5F5F5] rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                      {selectedUser.image || selectedUser.profileImage ? (
                        <img
                          src={selectedUser.image || selectedUser.profileImage}
                          alt={
                            selectedUser.username || selectedUser.name || "User"
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-6 w-6 bg-slate-400 rounded-full" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1">
                        <p className="text-[#2D2D2D] font-semibold text-base">
                          {selectedUser.username || "User"}
                        </p>
                        {selectedUser.identityVerificationStatus ===
                          "APPROVED" && (
                          <Check className="h-4 w-4 text-[#14C3CF]" />
                        )}
                      </div>
                      <p className="text-[#8F98A0] text-sm">
                        {selectedUser.name || ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStep(1);
                    }}
                    className="p-2 hover:bg-slate-200 rounded-full"
                  >
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Source Link */}
            <div className="mb-6">
              <p className="text-[#2D2D2D] text-[15px] font-medium mb-3">
                Source Link
              </p>
              <div className="relative mb-4">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 text-slate-400 mr-2"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Paste social media link"
                  value={sourceLink}
                  onChange={(e) => setSourceLink(e.target.value)}
                  className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-12 outline-none focus:ring-2 focus:ring-[#14C3CF]/20 text-base"
                />
              </div>
            </div>

            {/* Select Platform */}
            <div className="mb-6">
              <p className="text-[#2D2D2D] text-[15px] font-medium mb-3">
                Select Platform
              </p>
              <div className="flex flex-wrap gap-3">
                {platforms.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id as Platform)}
                    className={`flex items-center space-x-2 px-5 py-3 rounded-2xl border-2 transition-all ${
                      platform === p.id
                        ? "border-[#14C3CF] bg-[#14C3CF]/10"
                        : "border-slate-200 bg-[#F5F5F5]"
                    }`}
                    style={{
                      color: platform === p.id ? "#14C3CF" : "#2D2D2D",
                    }}
                  >
                    <div
                      className={
                        platform === p.id ? "text-[#14C3CF]" : "text-slate-400"
                      }
                    >
                      {p.icon}
                    </div>
                    <span className="text-sm font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="mb-6">
              <p className="text-[#2D2D2D] text-[15px] font-medium mb-3">
                Additional Notes
              </p>
              <div className="relative">
                <MessageCircle className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                <textarea
                  placeholder="Add notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-[#F5F5F5] rounded-2xl px-12 pr-5 py-4 outline-none focus:ring-2 focus:ring-[#14C3CF]/20 resize-none text-base"
                />
              </div>
            </div>

            {/* Bottom buttons now in scrollable area */}
            <div className="flex items-center gap-3 pb-6 w-full">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-[32%] h-14 bg-[#F8F9FA] text-[#8E9AA0] rounded-full font-medium text-base active:scale-[0.98] transition-all"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={loading || !sourceLink || !selectedUser}
                className={`flex-1 h-14 rounded-full font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center ${
                  sourceLink && selectedUser
                    ? "bg-[#14C3CF] text-white shadow-sm"
                    : "bg-[#839297] text-[#FFFFFF] cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <div className="h-6 w-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Submit Report"
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
