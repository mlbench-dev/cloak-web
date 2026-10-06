"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Link2, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import { showPlanLimitToast } from "@/app/components/planLimitToast";

const MAX_NOTES_LENGTH = 300;
const truncateText = (text: string, maxChars: number) =>
  text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}...` : text;
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
    id: "instagram",
    label: "Instagram",
    icon: (
      <Image
        src="/images/social-media/insta.svg"
        alt="Instagram"
        width={20}
        height={20}
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
        width={20}
        height={20}
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
        width={20}
        height={20}
      />
    ),
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: (
      <Image
        src="/images/social-media/tiktok.svg"
        alt="TikTok"
        width={20}
        height={20}
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
        className="h-5 w-5"
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

function getValidSourceUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function SubmitReportPage() {
  const { status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: select target user, 2: enter details
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isClearingSearches, setIsClearingSearches] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sourceLink, setSourceLink] = useState("");
  const [platform, setPlatform] = useState<Platform>("other");
  const [notes, setNotes] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const validSourceUrl = useMemo(
    () => getValidSourceUrl(sourceLink),
    [sourceLink],
  );
  const hasInvalidSourceLink = sourceLink.trim().length > 0 && !validSourceUrl;
  const detectedPlatform = useMemo(() => {
    if (!validSourceUrl) return null;
    return detectPlatform(validSourceUrl);
  }, [validSourceUrl]);
  const isPlatformLocked =
    detectedPlatform !== null && detectedPlatform !== "other";
  const linkCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const linkCheckAbortRef = useRef<AbortController | null>(null);
  const [isCheckingLink, setIsCheckingLink] = useState(false);
  const [isReachableLink, setIsReachableLink] = useState<boolean | null>(null);
  const [linkStatusCode, setLinkStatusCode] = useState<number | null>(null);

  // Fetch recent searches on load
  const hasFetchedRecentSearches = useRef(false);
  useEffect(() => {
    if (status === "authenticated" && !hasFetchedRecentSearches.current) {
      hasFetchedRecentSearches.current = true;
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

  const upsertRecentSearchState = (search: RecentSearch) => {
    setRecentSearches((prev) => {
      const next = [search, ...prev.filter((item) => item._id !== search._id)];
      return next.slice(0, 10);
    });
  };

  const saveRecentSearch = async (user: User) => {
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: user._id,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data?.search) {
        upsertRecentSearchState(data.search);
        return;
      }
      if (!res.ok && data?.error) {
        // Plan-limit blocks (daily search cap / saved-lookups cap) land
        // here — the user can still pick this person and submit a report
        // (that's a separate limit check), they just won't get a saved
        // lookup out of it this time.
        if (data.code === "PLAN_LIMIT_REACHED") {
          showPlanLimitToast(data.error);
        } else {
          toast.error(data.error);
        }
      }
    } catch (error) {
      console.error("Error saving recent search:", error);
    }
  };

  const handleSelectUser = async (user: User, persistRecentSearch = false) => {
    setSelectedUser(user);
    setStep(2);

    if (persistRecentSearch) {
      await saveRecentSearch(user);
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
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery)}`,
        );
        const data = await res.json();
        setSearchResults(data.success ? data.users : []);
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);
  }, [searchQuery]);

  // Detect platform when source link changes
  useEffect(() => {
    if (detectedPlatform) {
      setPlatform(detectedPlatform);
    }
  }, [detectedPlatform]);
  const clearAllRecentSearches = async () => {
    if (recentSearches.length === 0 || isClearingSearches) return;

    setIsClearingSearches(true);
    const previousSearches = recentSearches;
    setRecentSearches([]); // optimistic clear

    try {
      const results = await Promise.all(
        previousSearches.map((search) =>
          fetch(`/api/reports?searchId=${search._id}`, { method: "DELETE" }),
        ),
      );

      const anyFailed = results.some((res) => !res.ok);
      if (anyFailed) {
        // Re-fetch from server to reconcile partial failures
        await fetchRecentSearches();
        toast.error("Some searches couldn't be cleared");
      } else {
        toast.success("Recent searches cleared");
      }
    } catch (error) {
      console.error("Error clearing recent searches:", error);
      setRecentSearches(previousSearches); // rollback on total failure
      toast.error("Failed to clear searches");
    } finally {
      setIsClearingSearches(false);
    }
  };
  useEffect(() => {
    if (linkCheckTimeoutRef.current) {
      clearTimeout(linkCheckTimeoutRef.current);
    }
    if (linkCheckAbortRef.current) {
      linkCheckAbortRef.current.abort();
      linkCheckAbortRef.current = null;
    }

    if (!validSourceUrl) {
      setIsCheckingLink(false);
      setIsReachableLink(null);
      setLinkStatusCode(null);
      return;
    }

    setIsCheckingLink(true);
    setIsReachableLink(null);
    setLinkStatusCode(null);

    linkCheckTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      linkCheckAbortRef.current = controller;

      try {
        const params = new URLSearchParams({ url: validSourceUrl });
        const response = await fetch(`/api/link-preview?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        setIsReachableLink(Boolean(data?.reachable));
        setLinkStatusCode(
          typeof data?.statusCode === "number" ? data.statusCode : null,
        );
      } catch {
        setIsReachableLink(false);
        setLinkStatusCode(null);
      } finally {
        setIsCheckingLink(false);
      }
    }, 450);

    return () => {
      if (linkCheckTimeoutRef.current) {
        clearTimeout(linkCheckTimeoutRef.current);
      }
      if (linkCheckAbortRef.current) {
        linkCheckAbortRef.current.abort();
        linkCheckAbortRef.current = null;
      }
    };
  }, [validSourceUrl]);

  const handleSubmitReport = async () => {
    if (!selectedUser || !validSourceUrl) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (hasInvalidSourceLink) {
      toast.error("Please enter a valid link");
      return;
    }

    if (isCheckingLink) {
      toast.error("Please wait while we verify the link");
      return;
    }

    if (isReachableLink === false || isReachableLink === null) {
      toast.error("Please enter a reachable link");
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
          sourceLink: validSourceUrl,
          platform,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Report submitted successfully!");
        router.push("/profile");
      } else if (data.code === "PLAN_LIMIT_REACHED") {
        showPlanLimitToast(data.error);
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

  const getSubmitRequirementMessage = () => {
    if (!selectedUser) return "Please select a target user";
    if (!sourceLink.trim()) return "Please add a source link";
    if (hasInvalidSourceLink) return "Please enter a valid link";
    if (isCheckingLink) return "Please wait while we verify the link";
    if (isReachableLink !== true) return "Please enter a reachable link";
    return null;
  };

  const submitRequirementMessage = getSubmitRequirementMessage();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
      </div>
    );
  }

  const renderUser = (user: User) => (
    <div className="flex min-w-0 items-center gap-2">
      <div className="h-[42px] w-[42px] shrink-0 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
        <img
          src={
            user.image || user.profileImage || "/images/placeholder_avatar.png"
          }
          alt={user.username || user.name || "User"}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[16px] leading-[22px] text-[#2B2B2B]">
            {user.username || "User"}
          </p>
          {user.identityVerificationStatus === "APPROVED" && (
            <VerifiedBadge className="h-4 w-4 shrink-0 text-[#14C3CF]" />
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] leading-4 text-[#839297]">
          {truncateText(user.name || "", 20)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="shrink-0 flex items-center justify-between gap-3 bg-white pt-2 pb-1">
        <div className="min-w-0">
          <h1 className="text-[24px] font-medium leading-[30px] text-[#2B2B2B]">
            Submit Report
          </h1>
          <p className="mt-1 text-[14px] leading-5 text-[#839297]">
            Fill in the details below
          </p>
        </div>
        {step === 1 && (
          <button
            onClick={() => router.push("/my-reports")}
            className="h-[30px] shrink-0 rounded-full bg-[#01C3CF] px-[15px] text-[12px] text-white"
          >
            My Reports
          </button>
        )}
      </header>

      {step === 1 ? (
        <div className="-mx-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 pt-5 pb-4">
          <p className="mb-2 text-[14px] leading-5 text-[#2B2B2B]">
            Target User
          </p>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#839297]" />
            <input
              type="text"
              placeholder="Search target user via username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 bg-[#F6F6F6] rounded-full pl-11 pr-11 outline-none focus:ring-2 focus:ring-[#14C3CF]/20 text-base text-[#2B2B2B] placeholder:text-[14px] placeholder:text-[#839297]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              >
                <X className="h-[18px] w-[18px] text-[#839297]" />
              </button>
            )}
          </div>

          {/* Recent searches - now below input */}
          {!searchQuery && (
            <div className="mt-5">
              <div className="mb-3.5 flex items-center justify-between">
                <p className="text-[14px] leading-5 text-[#2B2B2B]">
                  Recent Searches
                </p>
                {recentSearches.length > 0 && (
                  <button
                    onClick={clearAllRecentSearches}
                    disabled={isClearingSearches}
                    className="text-[14px] leading-5 text-[#839297] disabled:opacity-50"
                  >
                    {isClearingSearches ? "Clearing..." : "Clear All"}
                  </button>
                )}
              </div>

              {recentSearches.length > 0 ? (
                <div className="space-y-4">
                  {recentSearches
                    .filter((search) => search.targetUser)
                    .map((search) => (
                      <div
                        key={search._id}
                        onClick={() =>
                          void handleSelectUser(search.targetUser, false)
                        }
                        className="cursor-pointer flex items-center justify-between gap-3"
                      >
                        {renderUser(search.targetUser)}
                        <button
                          onClick={(e) => deleteRecentSearch(search._id, e)}
                          className="shrink-0 py-1 pl-1"
                        >
                          <X
                            className="h-[22px] w-[22px] text-[#839297]"
                            strokeWidth={1.5}
                          />
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-[#839297] text-[12px]">
                    You have no recent searches
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Search results */}
          {searchQuery.trim().length > 0 && (
            <div className="mt-4 space-y-2.5">
              {isSearchingUsers ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 border-3 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => void handleSelectUser(user, true)}
                    className="flex cursor-pointer items-center rounded-[20px] bg-[#F6F6F6] px-3.5 py-3 transition-colors hover:bg-[#EBEBEB]"
                  >
                    {renderUser(user)}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-[#839297] text-[12px]">User not found</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="-mx-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 pt-5 pb-4">
          <div className="flex min-h-full flex-col">
            {/* Selected target user */}
            {selectedUser && (
              <div className="mb-5">
                <p className="mb-2 text-[14px] leading-5 text-[#2B2B2B]">
                  Target User
                </p>
                <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[#F6F6F6] px-3.5 py-3">
                  {renderUser(selectedUser)}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStep(1);
                    }}
                    className="-mr-1 shrink-0 p-1"
                  >
                    <X
                      className="h-[22px] w-[22px] text-[#839297]"
                      strokeWidth={1.5}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Source Link */}
            <div className="mb-5">
              <p className="mb-2 text-[14px] leading-5 text-[#2B2B2B]">
                Source Link
              </p>
              <div className="relative">
                <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#839297]" />
                <input
                  type="text"
                  placeholder="Paste social media link"
                  value={sourceLink}
                  onChange={(e) => setSourceLink(e.target.value)}
                  className={`w-full h-11 rounded-full pl-11 pr-4 outline-none focus:ring-2 text-base text-[#2B2B2B] placeholder:text-[14px] placeholder:text-[#839297] ${
                    hasInvalidSourceLink
                      ? "bg-[#FFF5F5] focus:ring-[#FF6B6B]/20"
                      : "bg-[#F6F6F6] focus:ring-[#14C3CF]/20"
                  }`}
                />
              </div>
              {hasInvalidSourceLink && (
                <p className="mt-1.5 text-[12px] text-[#FF6B6B]">
                  Please enter a valid link
                </p>
              )}
              {!hasInvalidSourceLink && validSourceUrl && (
                <p
                  className={`mt-1.5 text-[12px] ${
                    isCheckingLink
                      ? "text-[#839297]"
                      : isReachableLink
                        ? "text-[#14C3CF]"
                        : "text-[#FF6B6B]"
                  }`}
                >
                  {isCheckingLink
                    ? "Checking link..."
                    : isReachableLink
                      ? "Link looks reachable."
                      : `Link is not reachable${
                          linkStatusCode ? ` (HTTP ${linkStatusCode})` : ""
                        }.`}
                </p>
              )}
            </div>

            {/* Select Platform */}
            <div className="mb-5">
              <p className="mb-2 text-[14px] leading-5 text-[#2B2B2B]">
                Select Platform
              </p>
              <div className="flex flex-wrap gap-2.5">
                {platforms.map((p) => {
                  const isActive = platform === p.id;
                  const isDisabled =
                    isPlatformLocked && detectedPlatform !== p.id;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setPlatform(p.id as Platform)}
                      className={`flex h-10 items-center gap-2 rounded-2xl px-3.5 text-[14px] transition-all ${
                        isActive
                          ? "bg-[#E6FEFF] text-[#00C2CE]"
                          : "bg-[#F6F6F6] text-[#2B2B2B]"
                      } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span
                        className={`shrink-0 ${
                          isActive ? "text-[#00C2CE]" : "text-slate-400"
                        }`}
                      >
                        {p.icon}
                      </span>
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <p className="mb-2 text-[14px] leading-5 text-[#2B2B2B]">
                Additional Notes
              </p>
              <textarea
                placeholder="Add notes (optional)"
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))
                }
                className="block h-[120px] w-full resize-none rounded-[20px] bg-[#F6F6F6] px-4 py-3 outline-none focus:ring-2 focus:ring-[#14C3CF]/20 text-base text-[#2B2B2B] placeholder:text-[14px] placeholder:text-[#839297]"
              />
              <div className="mt-1.5 flex justify-end text-[12px] text-[#839297]">
                {notes.length}/{MAX_NOTES_LENGTH}
              </div>
            </div>

            {/* Bottom buttons stay in the scrollable area, pushed to the
                bottom of the screen when there's room */}
            <div className="mt-auto flex w-full items-center gap-2.5 pt-7">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-[45px] w-[117px] shrink-0 rounded-full bg-[#F6F6F6] text-[14px] text-[#839297] active:scale-[0.98] transition-all"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => {
                  if (loading) return;
                  if (submitRequirementMessage) {
                    toast.error(submitRequirementMessage);
                    return;
                  }
                  void handleSubmitReport();
                }}
                aria-disabled={Boolean(submitRequirementMessage) || loading}
                className={`flex-1 h-[45px] rounded-full text-[14px] active:scale-[0.98] transition-all flex items-center justify-center ${
                  validSourceUrl &&
                  selectedUser &&
                  !isCheckingLink &&
                  isReachableLink === true
                    ? "bg-[#01C3CF] text-white"
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
        </div>
      )}
    </div>
  );
}
