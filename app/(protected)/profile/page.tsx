"use client";

import {
  Crown,
  Edit3,
  ChevronRight,
  LogOut,
  Trash2,
  ShieldCheck,
  FileText,
  Camera,
  Bookmark,
  User as UserIcon,
  X,
  Trophy,
  Flag,
  Shield,
  Search,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { BadgeCheckIcon } from "@/public/svgIcons";
import IdentityVerificationStep from "@/app/components/auth/IdentityVerificationStep";
import { PostCard } from "@/app/(protected)/cloak-watch/_components/PostUI";
import {
  fetchPosts,
  type CloakWatchPost,
  type CloakWatchPostScope,
} from "@/app/(protected)/cloak-watch/_lib/posts";

type ProfileView =
  | "main"
  | "edit"
  | "verification"
  | "verified-status"
  | "posts";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [view, setView] = useState<ProfileView>("main");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [postsViewTitle, setPostsViewTitle] = useState("");
  const [postsScope, setPostsScope] = useState<CloakWatchPostScope>("all");
  const [postsQuery, setPostsQuery] = useState("");
  const [profilePosts, setProfilePosts] = useState<CloakWatchPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // No explicit session refresh needed on profile mount.
  // useSession() already loads the current session, and extra update() calls can trigger repeated auth requests.
  const user = session?.user as any;
  const username =
    user?.username || user?.name?.split(" ")[0].toLowerCase() || "user";
  const email = user?.email || "";
  const profileImage = user?.image || user?.profileImage;
  const isVerified = user?.isVerified || false;
  const isPremium = user?.role === "VERIFIED_USER" || false;
  const [imageLoading, setImageLoading] = useState(true);
  const [profileStats, setProfileStats] = useState<{
    totalReports: number;
    approvedReports: number;
    accuracyPercentage: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const hasFetchedProfileStats = useRef(false);

  const [editData, setEditData] = useState({
    username: username,
    displayName: user?.name || "",
    email: email,
  });

  // Update editData when session user data changes
  useEffect(() => {
    if (session?.user) {
      const user = session.user as any;
      setEditData({
        username:
          user?.username || user?.name?.split(" ")[0].toLowerCase() || "user",
        displayName: user?.name || "",
        email: user?.email || "",
      });
    }
  }, [session]);

  useEffect(() => {
    const fetchProfileStats = async () => {
      setStatsLoading(true);
      try {
        const res = await fetch("/api/user/dashboard");
        const data = await res.json();
        if (data?.success && data?.stats) {
          setProfileStats({
            totalReports: Number(data.stats.totalReports || 0),
            approvedReports: Number(data.stats.verifiedReports || 0),
            accuracyPercentage: Number(data.stats.accuracyPercentage || 0),
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setStatsLoading(false);
      }
    };

    if (status === "authenticated") {
      if (hasFetchedProfileStats.current) return;
      hasFetchedProfileStats.current = true;
      fetchProfileStats();
    }
  }, [status]);

  const handleProfileImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Upload file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "profile");
      formData.append("userId", user.id || "");

      const uploadRes = await fetch("/api/auth/upload", {
        method: "POST",
        body: formData,
      });

      const { url: downloadURL } = await uploadRes.json();

      // Update profile in DB
      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, image: downloadURL }),
      });

      if (response.ok) {
        // Update session
        await update({ image: downloadURL });
      } else {
        const data = await response.json();
        setError(data.error || "Failed to upload profile picture.");
      }
    } catch (err) {
      console.error("Failed to upload profile pic", err);
      setError("An unexpected error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/?authStep=EMAIL" });
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;

    setIsDeletingAccount(true);
    const toastId = toast.loading("Deleting your account...");

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account.");
      }

      toast.success("Account deleted permanently.", { id: toastId });
      await signOut({ callbackUrl: "/?authStep=EMAIL" });
    } catch (error) {
      console.error("Failed to delete account", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account.",
        { id: toastId },
      );
      setIsDeletingAccount(false);
    }
  };

  const handleEditProfile = async () => {
    try {
      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          username: editData.username,
          name: editData.displayName,
        }),
      });
      if (response.ok) {
        await update({
          username: editData.username,
          name: editData.displayName,
        });
        setView("main");
      }
    } catch (error) {
      console.error("Failed to update profile", error);
    }
  };

  const handleIdentitySubmit = async (data: {
    documentType: string;
    files: File[];
  }) => {
    setIsUploading(true);
    setError(null);
    try {
      // Upload files to Local Storage via API
      const uploadPromises = data.files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "identity");
        formData.append("userId", user.id || "");

        const res = await fetch("/api/auth/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to upload document.");
        }
        const json = await res.json();
        return json.url;
      });

      const documentUrls = await Promise.all(uploadPromises);
      const response = await fetch("/api/auth/identity-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          documentType: data.documentType,
          documentUrls,
        }),
      });
      if (response.ok) {
        // Update the session status
        await update({
          identityVerificationStatus: "PENDING",
          documentType: data.documentType,
        });
        // The view change is handled by IdentityVerificationStep internal state "submitted"
        // but here we might want to stay in "verification" view as it handles the Step component
      } else {
        const resData = await response.json();
        setError(resData.error || "Failed to submit identity verification.");
        return false;
      }
    } catch (error) {
      console.error("Failed to submit identity verification", error);
      setError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
      );
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const openPostsView = async (
    title: string,
    scope: Extract<CloakWatchPostScope, "my" | "saved">,
  ) => {
    setPostsViewTitle(title);
    setPostsScope(scope);
    setPostsQuery("");
    setView("posts");
  };

  useEffect(() => {
    if (view !== "posts" || (postsScope !== "my" && postsScope !== "saved")) {
      return;
    }

    const timeout = setTimeout(async () => {
      setPostsLoading(true);
      try {
        const posts = await fetchPosts(postsQuery, { scope: postsScope });
        setProfilePosts(posts);
      } catch (error) {
        console.error(`Failed to load ${postsScope} posts`, error);
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to load ${postsViewTitle}.`,
        );
        setProfilePosts([]);
      } finally {
        setPostsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [view, postsScope, postsQuery, postsViewTitle]);

  const handleVerificationClick = () => {
    if (
      user?.identityVerificationStatus === "APPROVED" ||
      user?.identityVerificationStatus === "REJECTED"
    ) {
      setView("verification");
    } else if (isVerified) {
      setView("verified-status");
    } else if (user?.identityVerificationStatus === "PENDING") {
      setView("verified-status");
    } else {
      setView("verification");
    }
  };

  if (view === "verified-status") {
    const isPending = user?.identityVerificationStatus === "PENDING";
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 px-6 text-center">
        <div
          className={`h-20 w-20 ${isPending ? "bg-[#00C3D0]/10" : "bg-[#00C3D0]/10"} rounded-full flex items-center justify-center`}
        >
          {isPending ? (
            <ShieldCheck size={40} className="text-[#00C3D0]" />
          ) : (
            <BadgeCheckIcon size={40} activeColor="#00C3D0" isActive={true} />
          )}
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          {isPending ? "Verification Under Process" : "Already Verified"}
        </h2>
        <p className="text-slate-500">
          {isPending
            ? "Upload your protected images to verify your identity."
            : "Your identity has been verified. You now have a verification badge on your profile!"}
        </p>
        <button
          onClick={() => {
            if (isPending) {
              window.location.href = "/reference-media?mode=onboarding";
              return;
            }
            setView("main");
          }}
          className={`mt-4 px-8 py-3 ${isPending ? "bg-[#00C3D0]" : "bg-[#00C3D0]"} text-white rounded-full font-medium shadow-lg shadow-[#00C3D0]/20 active:scale-[0.98] transition-all`}
        >
          {isPending ? "Upload Media" : "Go Back"}
        </button>
      </div>
    );
  }

  if (view === "verification") {
    const handleVerificationAction = () => {
      if (user?.identityVerificationStatus === "REJECTED") {
        window.location.href = "/reference-media?mode=profile";
        return;
      }
      setView("main");
    };

    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center py-4 bg-white">
          <button onClick={() => setView("main")} className="p-2">
            <ChevronRight className="h-6 w-6 rotate-180 text-slate-400" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold mr-10">
            Verification
          </h1>
        </header>
        <div className="flex-1">
          <IdentityVerificationStep
            onSkip={() => setView("main")}
            onSubmit={handleIdentitySubmit}
            onContinueToDashboard={handleVerificationAction}
            error={error}
            hideHeader={true}
            showSkip={false}
            status={user?.identityVerificationStatus}
            isLoading={isUploading}
          />
        </div>
      </div>
    );
  }

  if (view === "posts") {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <header className="shrink-0 bg-white">
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={() => setView("main")} className="p-2">
              <ChevronRight className="h-6 w-6 rotate-180 text-slate-400" />
            </button>
            <h1 className="text-lg font-semibold text-[#2D2D2D]">
              {postsViewTitle}
            </h1>
            <div className="w-10" />
          </div>

          <div className="px-4 pb-2">
            <div className="flex items-center gap-3 rounded-full bg-[#F3F3F3] px-4 py-3">
              <Search className="h-5 w-5 text-[#98A0A7]" />
              <input
                value={postsQuery}
                onChange={(e) => setPostsQuery(e.target.value)}
                placeholder="Search posts,people,topics..."
                className="w-full bg-transparent text-[14px] text-[#2D2D2D] outline-none placeholder:text-[#98A0A7]"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2 no-scrollbar">
          {postsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
            </div>
          ) : profilePosts.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#14C3CF]/10">
                {postsScope === "my" ? (
                  <FileText className="h-7 w-7 text-[#14C3CF]" />
                ) : (
                  <Bookmark className="h-7 w-7 text-[#14C3CF]" />
                )}
              </div>
              <h2 className="mt-4 text-[18px] font-semibold text-[#2D2D2D]">
                No {postsScope === "my" ? "posts" : "saved posts"} yet
              </h2>
              <p className="mx-auto mt-2 max-w-[260px] text-[14px] leading-6 text-[#8F98A0]">
                {postsScope === "my"
                  ? "Posts you create in Cloak Watch will appear here."
                  : "Posts you save from Cloak Watch will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {profilePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onOpenPost={(selectedPost) =>
                    router.push(`/cloak-watch/post/${selectedPost.id}`)
                  }
                  onDeleted={(postId) =>
                    setProfilePosts((prev) =>
                      prev.filter((item) => item.id !== postId),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "edit") {
    return (
      <div className="flex flex-col h-full bg-white">
        <header className="shrink-0 flex items-center justify-between py-4 px-4 bg-white">
          <button onClick={() => setView("main")} className="p-2">
            <ChevronRight className="h-6 w-6 rotate-180 text-slate-400" />
          </button>
          <h1 className="text-lg font-semibold">Edit Profile</h1>
          <div className="w-10" />
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8 space-y-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-slate-50 shadow-sm cursor-pointer active:scale-95 transition-transform bg-gray-200 flex items-center justify-center"
              >
                {imageLoading && !profileImage && (
                  <UserIcon className="h-16 w-16 text-gray-400" />
                )}
                {profileImage && (
                  <Image
                    src={profileImage}
                    alt="Profile"
                    fill
                    className="object-cover"
                    onLoadingComplete={() => setImageLoading(false)}
                  />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileImageUpload}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleProfileImageUpload}
              />
              <button
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="absolute bottom-1 right-1 h-8 w-8 bg-[#14C3CF] rounded-full flex items-center justify-center border-2 border-white disabled:opacity-50 active:scale-90 transition-all"
              >
                <Camera className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 ml-1">
                Username
              </label>
              <input
                type="text"
                value={editData.username}
                disabled
                className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-5 outline-none opacity-60 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 ml-1">
                Display Name
              </label>
              <input
                type="text"
                value={editData.displayName}
                onChange={(e) =>
                  setEditData({ ...editData, displayName: e.target.value })
                }
                className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-5 outline-none focus:ring-2 ring-[#14C3CF]/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 ml-1">
                Email
              </label>
              <input
                type="email"
                value={editData.email}
                disabled
                className="w-full h-14 bg-[#F5F5F5] rounded-2xl px-5 outline-none opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pb-6">
            <button
              onClick={handleEditProfile}
              className="w-full h-14 bg-[#14C3CF] text-white rounded-full font-semibold text-lg shadow-lg shadow-[#14C3CF]/20 active:scale-[0.98] transition-all"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="shrink-0 bg-white px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <h1 className="text-center text-[17px] font-semibold text-[#2D2D2D]">
          Profile
        </h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar bg-white">
        <div className="space-y-5 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <section className="pb-2 pt-1">
            <div className="flex items-start gap-4">
              <div className="relative mt-1 h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full bg-gray-200 flex items-center justify-center">
                {imageLoading && !profileImage && (
                  <UserIcon className="h-7 w-7 text-gray-400" />
                )}
                {profileImage && (
                  <Image
                    src={profileImage}
                    alt="Profile"
                    fill
                    className="object-cover"
                    onLoadingComplete={() => setImageLoading(false)}
                  />
                )}
              </div>

              <div className="flex flex-1 justify-between pt-1">
                <div className="min-w-[64px] text-center">
                  <p className="text-[18px] font-semibold text-[#2D2D2D]">
                    {statsLoading ? "—" : (profileStats?.totalReports ?? 0)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#A7ADB2]">Reports</p>
                </div>
                <div className="min-w-[64px] text-center">
                  <p className="text-[18px] font-semibold text-[#2D2D2D]">
                    {statsLoading ? "—" : (profileStats?.approvedReports ?? 0)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#A7ADB2]">Verified</p>
                </div>
                <div className="min-w-[64px] text-center">
                  <p className="text-[18px] font-semibold text-[#2D2D2D]">
                    {statsLoading
                      ? "—"
                      : `${profileStats?.accuracyPercentage ?? 0}%`}
                  </p>
                  <p className="mt-1 text-[13px] text-[#A7ADB2]">Accuracy</p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[16px] font-medium text-[#2D2D2D]">
                  {username}
                </h2>
                {isVerified && (
                  <BadgeCheckIcon
                    size={20}
                    activeColor="#00C3D0"
                    isActive={true}
                  />
                )}
                {isPremium && (
                  <Crown className="h-[18px] w-[18px] fill-[#14C3CF] text-[#14C3CF]" />
                )}
              </div>
              <p className="text-[14px] text-[#A7ADB2]">
                {user?.name || username}
              </p>
            </div>
          </section>

          <MenuGroup>
            <MenuButton
              icon={<Edit3 size={19} className="text-[#14C3CF]" />}
              label="Edit profile"
              onClick={() => setView("edit")}
              showDivider={true}
            />
            <MenuButton
              icon={<Crown size={19} className="text-[#14C3CF]" />}
              label="Subscription"
              onClick={() => router.push("/subscription")}
              showDivider={true}
            />
            <MenuButton
              icon={<Trophy size={19} className="text-[#14C3CF]" />}
              label="Your Progress"
              onClick={() => router.push("/progress")}
              showDivider={true}
            />
            <MenuButton
              icon={<Flag size={19} className="text-[#14C3CF]" />}
              label="My Reports"
              onClick={() => router.push("/my-reports")}
              showDivider={true}
            />
            <MenuButton
              icon={<FileText size={19} className="text-[#14C3CF]" />}
              label="My Posts"
              onClick={() => void openPostsView("My Posts", "my")}
              showDivider={true}
            />
            <MenuButton
              icon={<Bookmark size={19} className="text-[#14C3CF]" />}
              label="Saved Posts"
              onClick={() => void openPostsView("Saved Posts", "saved")}
            />
          </MenuGroup>

          <MenuGroup>
            <MenuButton
              icon={<ShieldCheck size={19} className="text-[#14C3CF]" />}
              label="Verification"
              onClick={handleVerificationClick}
              showDivider={true}
            />
            <MenuButton
              icon={<Camera size={19} className="text-[#14C3CF]" />}
              label="Reference Media"
              onClick={() => router.push("/reference-media?mode=profile")}
            />
          </MenuGroup>

          <MenuGroup>
            <MenuButton
              icon={<Shield size={19} className="text-[#14C3CF]" />}
              label="Privacy Policy"
              onClick={() => router.push("/privacy-policy")}
            />
          </MenuGroup>

          <MenuGroup>
            <MenuButton
              icon={<LogOut size={19} className="text-[#EF4444]" />}
              label="Log Out"
              onClick={() => setShowLogoutModal(true)}
              variant="danger"
              showDivider={true}
            />
            <MenuButton
              icon={<Trash2 size={19} className="text-[#EF4444]" />}
              label="Delete Account"
              onClick={() => setShowDeleteAccountModal(true)}
              variant="danger"
            />
          </MenuGroup>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-[340px] bg-white rounded-[32px] p-6 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-[20px] font-bold text-[#2D2D2D]">Log Out</h3>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="p-2 hover:bg-slate-50 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <p className="text-[16px] leading-relaxed text-[#8F98A0]">
              Are you sure you want to log out of your account?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 h-14 rounded-full bg-[#F5F5F5] font-semibold text-[#2D2D2D] hover:bg-[#EBEBEB] active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 h-14 rounded-full bg-red-500 font-semibold text-white shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-[340px] bg-white rounded-[32px] p-6 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-[20px] font-bold text-[#2D2D2D]">
                Delete Account
              </h3>
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                className="p-2 hover:bg-slate-50 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <p className="text-[15px] leading-relaxed text-[#2D2D2D]">
              This will permanently delete your account, profile, protected
              media, identity verification data, reports, and recent searches.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                className="flex-1 h-14 rounded-full bg-[#F5F5F5] font-semibold text-[#2D2D2D] hover:bg-[#EBEBEB] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="flex-1 h-14 rounded-full bg-red-500 font-semibold text-white shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center"
              >
                {isDeletingAccount ? (
                  <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  variant = "default",
  showDivider = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  showDivider?: boolean;
}) {
  return (
    <div>
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between bg-white px-4 py-[18px] active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              variant === "danger" ? "bg-[#FFF4F4]" : "bg-[#EAF9FA]"
            }`}
          >
            {icon}
          </div>
          <span
            className={`text-[16px] font-medium ${
              variant === "danger" ? "text-[#2D2D2D]" : "text-[#2D2D2D]"
            }`}
          >
            {label}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-[#B5BEC4]" />
      </button>
      {showDivider && (
        <div className="ml-[4.75rem] border-t border-[#F1F1F1]" />
      )}
    </div>
  );
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#F1F1F1] bg-white">
      {children}
    </div>
  );
}
