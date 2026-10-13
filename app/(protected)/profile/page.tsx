"use client";

import {
  Crown,
  CirclePlus,
  Edit3,
  ChevronLeft,
  LogOut,
  Trash2,
  ShieldCheck,
  FileText,
  Camera,
  Upload,
  Bookmark,
  User as UserIcon,
  X,
  RefreshCw,
  Trophy,
  Flag,
  Shield,
  Search,
  Settings,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import Cropper from "react-easy-crop";
import { BadgeCheckIcon } from "@/public/svgIcons";
import VerifiedBadge from "@/app/components/VerifiedBadge";
import BottomSheet from "@/app/components/BottomSheet";
import { MenuButton, MenuGroup } from "@/app/components/MenuList";
import IdentityVerificationStep from "@/app/components/auth/IdentityVerificationStep";
import { PostCard } from "@/app/(protected)/community/_components/PostUI";
import {
  fetchPosts,
  type CloakWatchPost,
  type CloakWatchPostScope,
} from "@/app/(protected)/community/_lib/posts";
import { getCroppedImg } from "@/lib/cropImage";

const getIdentityDraftStorageKey = (scopeKey?: string | null) =>
  `cloak-identity-verification-draft:${scopeKey || "anonymous"}`;

const MAX_DISPLAY_NAME_LENGTH = 30;

type ProfileView =
  | "main"
  | "edit"
  | "verification"
  | "verified-status"
  | "posts";

type ProfilePostsScope = Extract<CloakWatchPostScope, "my" | "saved">;

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ProfileView>("main");
  const [forceVerificationForm, setForceVerificationForm] = useState(false);
  const [verificationFormKey, setVerificationFormKey] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showDiscardChangesModal, setShowDiscardChangesModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [pendingProfileImageFile, setPendingProfileImageFile] =
    useState<File | null>(null);
  const [pendingProfileImageUrl, setPendingProfileImageUrl] = useState("");
  const [profileCropImageSrc, setProfileCropImageSrc] = useState<string | null>(
    null,
  );
  const [profileCrop, setProfileCrop] = useState({ x: 0, y: 0 });
  const [profileZoom, setProfileZoom] = useState(1);
  const [profileCroppedAreaPixels, setProfileCroppedAreaPixels] =
    useState<any>(null);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);
  const [showCameraCaptureModal, setShowCameraCaptureModal] = useState(false);
  const [profileCameraFacingMode, setProfileCameraFacingMode] = useState<
    "user" | "environment"
  >("user");
  const [profileCameraError, setProfileCameraError] = useState<string | null>(
    null,
  );
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [postsViewTitle, setPostsViewTitle] = useState("");
  const [postsScope, setPostsScope] = useState<ProfilePostsScope>("my");
  const [postsQuery, setPostsQuery] = useState("");
  const [profilePosts, setProfilePosts] = useState<CloakWatchPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileCameraVideoRef = useRef<HTMLVideoElement>(null);
  const profileCameraBackdropVideoRef = useRef<HTMLVideoElement>(null);
  const profileCameraStreamRef = useRef<MediaStream | null>(null);

  // No explicit session refresh needed on profile mount.
  // useSession() already loads the current session, and extra update() calls can trigger repeated auth requests.
  const user = session?.user as any;
  const username =
    user?.username || user?.name?.split(" ")[0].toLowerCase() || "user";
  const email = user?.email || "";
  // Placeholder only once the session user is known to have no image.
  const profileImage = user
    ? user.image || user.profileImage || "/images/placeholder_avatar.png"
    : undefined;
  const isVerified =
    user?.identityVerificationStatus === "APPROVED" ||
    user?.isVerified ||
    false;
  const [imageLoading, setImageLoading] = useState(true);

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

  // Username/email fields are disabled (not editable), so only the display
  // name and a pending new avatar can actually make the form dirty.
  const isProfileEditDirty =
    editData.displayName !== (user?.name || "") ||
    pendingProfileImageFile !== null;

  const exitEditProfile = () => router.push("/profile");

  // "Discard" only navigated away before — the picked/cropped avatar and any
  // typed display name stayed in memory, so returning to Edit Profile made
  // it look like nothing was discarded at all.
  const discardProfileEdits = () => {
    if (pendingProfileImageUrl) {
      URL.revokeObjectURL(pendingProfileImageUrl);
    }
    setPendingProfileImageFile(null);
    setPendingProfileImageUrl("");
    setEditData({ username, displayName: user?.name || "", email });
    exitEditProfile();
  };

  const handleEditProfileBack = () => {
    if (isProfileEditDirty) {
      setShowDiscardChangesModal(true);
      return;
    }
    exitEditProfile();
  };

  // Covers leaving via the browser (tab close, refresh, typing a new URL) —
  // the in-app back button above is what handles client-side navigation.
  useEffect(() => {
    if (view !== "edit" || !isProfileEditDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [view, isProfileEditDirty]);

  const handleProfileCropComplete = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setProfileCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  useEffect(() => {
    const verificationParam = searchParams.get("verification");
    if (verificationParam === "retry" || verificationParam === "document") {
      if (verificationParam === "retry") {
        window.sessionStorage.removeItem(getIdentityDraftStorageKey(user?.id));
      }
      setView("verification");
      setError(null);
      setForceVerificationForm(true);
      setVerificationFormKey((prev) => prev + 1);
      return;
    }

    const viewParam = searchParams.get("view");
    const scopeParam = searchParams.get("scope");

    if (viewParam === "edit") {
      setView("edit");
      return;
    }

    if (viewParam === "posts") {
      const nextScope: ProfilePostsScope =
        scopeParam === "saved" ? "saved" : "my";
      setPostsScope(nextScope);
      setPostsViewTitle(nextScope === "saved" ? "Saved Posts" : "My Posts");
      setPostsQuery("");
      setView("posts");
      return;
    }

    setView("main");
  }, [searchParams, user?.id]);

  useEffect(() => {
    return () => {
      if (pendingProfileImageUrl) {
        URL.revokeObjectURL(pendingProfileImageUrl);
      }
    };
  }, [pendingProfileImageUrl]);

  const stopProfileCameraStream = useCallback(() => {
    profileCameraStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
    profileCameraStreamRef.current = null;
    [
      profileCameraVideoRef.current,
      profileCameraBackdropVideoRef.current,
    ].forEach((video) => {
      if (video) {
        video.srcObject = null;
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      stopProfileCameraStream();
    };
  }, [stopProfileCameraStream]);

  const handleProfileImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    applyProfileImageFile(file);

    if (e.target) {
      e.target.value = "";
    }
  };

  const applyProfileImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        setProfileCropImageSrc(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    },
    [setError],
  );

  const startProfileCamera = useCallback(
    async (facingMode: "user" | "environment") => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setProfileCameraError(
          "Camera is not supported on this device. Please upload a photo instead.",
        );
        setShowCameraCaptureModal(true);
        return;
      }

      setIsStartingCamera(true);
      setProfileCameraError(null);
      setShowCameraCaptureModal(true);

      try {
        stopProfileCameraStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        const videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
          getCapabilities?: () => {
            zoom?: { min?: number; max?: number };
          };
          applyConstraints?: (
            constraints: MediaTrackConstraints,
          ) => Promise<void>;
        };

        try {
          const capabilities: {
            zoom?: { min?: number; max?: number };
          } | null =
            typeof videoTrack?.getCapabilities === "function"
              ? (videoTrack.getCapabilities() as any)
              : null;

          if (
            capabilities?.zoom &&
            typeof capabilities.zoom.min === "number" &&
            typeof videoTrack?.applyConstraints === "function"
          ) {
            await videoTrack.applyConstraints({
              advanced: [{ zoom: capabilities.zoom.min }] as any,
            });
          }
        } catch (zoomError) {
          console.error("Failed to reduce profile camera zoom", zoomError);
        }

        profileCameraStreamRef.current = stream;
        const videos = [
          profileCameraVideoRef.current,
          profileCameraBackdropVideoRef.current,
        ];
        await Promise.all(
          videos.map(async (video) => {
            if (!video) return;
            video.srcObject = stream;
            await video.play().catch(() => {});
          }),
        );
      } catch (cameraError) {
        console.error("Failed to start profile camera", cameraError);
        setProfileCameraError(
          "Allow camera access or upload a photo from your device.",
        );
      } finally {
        setIsStartingCamera(false);
      }
    },
    [stopProfileCameraStream],
  );

  const openPhotoSourceModal = () => {
    setShowPhotoSourceModal(true);
    setProfileCameraError(null);
  };

  const openCameraCapture = async (facingMode: "user" | "environment") => {
    setShowPhotoSourceModal(false);
    setProfileCameraFacingMode(facingMode);
    await startProfileCamera(facingMode);
  };

  const closeCameraCaptureModal = useCallback(() => {
    stopProfileCameraStream();
    setShowCameraCaptureModal(false);
    setProfileCameraError(null);
    setIsStartingCamera(false);
  }, [stopProfileCameraStream]);

  const switchProfileCamera = async () => {
    const nextFacingMode =
      profileCameraFacingMode === "user" ? "environment" : "user";
    setProfileCameraFacingMode(nextFacingMode);
    await startProfileCamera(nextFacingMode);
  };

  const handleCaptureProfilePhoto = async () => {
    const video = profileCameraVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Camera is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      toast.error("Unable to capture photo. Please try again.");
      return;
    }

    // Some front cameras return a mirrored frame. Flip it back before saving
    // so the uploaded image matches the user's real orientation.
    if (profileCameraFacingMode === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.95);
    });

    if (!blob) {
      toast.error("Unable to capture photo. Please try again.");
      return;
    }

    const file = new File([blob], "profile-camera.jpg", {
      type: "image/jpeg",
    });

    closeCameraCaptureModal();
    applyProfileImageFile(file);
  };

  const handleApplyProfileCrop = async () => {
    if (!profileCropImageSrc || !profileCroppedAreaPixels) return;

    try {
      const croppedImageBlob = await getCroppedImg(
        profileCropImageSrc,
        profileCroppedAreaPixels,
      );
      const croppedFile = new File([croppedImageBlob], "profile-picture.jpg", {
        type: "image/jpeg",
      });

      if (pendingProfileImageUrl) {
        URL.revokeObjectURL(pendingProfileImageUrl);
      }

      const previewUrl = URL.createObjectURL(croppedFile);
      setPendingProfileImageFile(croppedFile);
      setPendingProfileImageUrl(previewUrl);
      setProfileCropImageSrc(null);
      setProfileCrop({ x: 0, y: 0 });
      setProfileZoom(1);
      setProfileCroppedAreaPixels(null);
    } catch (cropError) {
      console.error("Failed to crop profile image", cropError);
      toast.error("Unable to crop image. Please try again.");
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
      let nextImage = pendingProfileImageFile
        ? undefined
        : user?.image || user?.profileImage;

      if (pendingProfileImageFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", pendingProfileImageFile);
        formData.append("type", "profile");
        formData.append("userId", user.id || "");

        const uploadRes = await fetch("/api/auth/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(
            uploadData.error || "Failed to upload profile picture.",
          );
        }
        nextImage = uploadData.url;
      }

      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          username: editData.username,
          name: editData.displayName,
          image: nextImage,
        }),
      });
      if (response.ok) {
        await update({
          username: editData.username,
          name: editData.displayName,
          image: nextImage,
        });
        toast.success("Profile updated successfully.");
        if (pendingProfileImageUrl) {
          URL.revokeObjectURL(pendingProfileImageUrl);
        }
        setPendingProfileImageFile(null);
        setPendingProfileImageUrl("");
        router.replace("/profile?view=edit");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to update profile.");
      }
    } catch (error) {
      console.error("Failed to update profile", error);
      setError(
        error instanceof Error ? error.message : "Failed to update profile.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleIdentitySubmit = async (data: {
    documentType: string;
    files: File[];
    existingUrls?: string[];
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

      const uploadedDocumentUrls = await Promise.all(uploadPromises);
      const documentUrls = [
        ...(data.existingUrls || []),
        ...uploadedDocumentUrls,
      ];
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
        try {
          window.sessionStorage.setItem(
            getIdentityDraftStorageKey(user.id),
            JSON.stringify({
              documentType: data.documentType,
              documentUrls,
            }),
          );
        } catch (storageError) {
          console.error("Failed to persist identity draft:", storageError);
        }

        router.replace("/reference-media?mode=profile");
        // Refresh the session in the background so navigation is immediate.
        void update({
          identityVerificationStatus: "PENDING",
          documentType: data.documentType,
        }).catch((sessionError) => {
          console.error(
            "Failed to refresh session after identity submit",
            sessionError,
          );
        });
        return false;
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

  const openPostsView = async (title: string, scope: ProfilePostsScope) => {
    setPostsViewTitle(title);
    router.push(`/profile?view=posts&scope=${scope}`);
  };

  useEffect(() => {
    router.prefetch("/reference-media?mode=profile");
  }, [router]);

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

  const handleVerificationClick = async () => {
    if (user?.identityVerificationStatus === "APPROVED") {
      router.push("/verification?status=APPROVED");
    } else if (user?.identityVerificationStatus === "REJECTED") {
      router.push("/verification?status=REJECTED");
    } else if (isVerified) {
      router.push("/verification?status=APPROVED");
    } else if (user?.identityVerificationStatus === "PENDING") {
      try {
        const response = await fetch("/api/auth/identity-verify");
        const data = await response.json().catch(() => null);
        if (response.ok && data?.verificationInProgress) {
          router.push("/verification?status=PENDING");
          return;
        }
      } catch (error) {
        console.error("Failed to load verification progress", error);
      }

      setView("verified-status");
    } else {
      setView("verification");
    }
  };

  if (view === "verified-status") {
    const isPending = user?.identityVerificationStatus === "PENDING";
    return (
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between  bg-white z-10">
          <button
            onClick={() => {
              router.push("/profile");
            }}
            className="-ml-3 p-2"
          >
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-[16px] font-medium text-[#2B2B2B]">Verification</h1>
          <div className="-mr-3 w-10" />
        </header>
        <div className="flex flex-1 flex-col items-center justify-center space-y-4 px-6 text-center">
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
            {isPending ? "Your Verification is Pending " : "Already Verified"}
          </h2>
          <p className="text-slate-500">
            {isPending
              ? "Upload your protected Document & images  to verify your identity."
              : "Your identity has been verified. You now have a verification badge on your profile!"}
          </p>
          <button
            onClick={() => {
              if (isPending) {
                setError(null);
                setForceVerificationForm(true);
                setVerificationFormKey((prev) => prev + 1);
                setView("verification");
                return;
              }
              setView("main");
            }}
            className={`mt-4 px-8 py-3 ${isPending ? "bg-[#00C3D0]" : "bg-[#00C3D0]"} text-white rounded-full font-medium shadow-lg shadow-[#00C3D0]/20 active:scale-[0.98] transition-all`}
          >
            {isPending ? "Upload Media" : "Go Back"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "verification") {
    const handleVerificationAction = () => {
      router.push("/reference-media?mode=profile");
    };

    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <header className="flex items-center justify-between  bg-white z-10">
          <button
            onClick={() => {
              setForceVerificationForm(false);
              setView("main");
            }}
            className="-ml-3 p-2"
          >
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-[16px] font-medium text-[#2B2B2B]">
            Verification
          </h1>
          <div className="-mr-3 w-10" />
        </header>
        <div className="flex-1">
          <IdentityVerificationStep
            key={verificationFormKey}
            onSkip={() => {
              setForceVerificationForm(false);
              setView("main");
            }}
            onSubmit={handleIdentitySubmit}
            onContinueToDashboard={handleVerificationAction}
            error={error}
            hideHeader={true}
            showSkip={false}
            status={
              forceVerificationForm
                ? undefined
                : user?.identityVerificationStatus
            }
            isLoading={isUploading}
            prefillFromSavedVerification={
              searchParams.get("verification") !== "retry"
            }
            draftScopeKey={user?.id}
          />
        </div>
      </div>
    );
  }

  if (view === "posts") {
    return (
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <header className="shrink-0 bg-white">
          <div className="flex items-center justify-between ">
            <button onClick={() => router.push("/profile")} className="-ml-3 p-2">
              <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
            </button>
            <h1 className="text-[16px] font-medium text-[#2B2B2B]">
              {postsViewTitle}
            </h1>
            {postsScope === "my" ? (
              <button
                type="button"
                aria-label="Saved posts"
                onClick={() => void openPostsView("Saved Posts", "saved")}
                className="-mr-2 flex h-10 w-10 items-center justify-center text-[#2B2B2B]"
              >
                <Bookmark className="h-[22px] w-[22px]" strokeWidth={1.8} />
              </button>
            ) : (
              <div className="-mr-3 w-10" />
            )}
          </div>

          <div className="pb-1 pt-1">
            <div className="flex h-10 items-center gap-2 rounded-full bg-[#F6F6F6] px-3.5">
              <Search className="h-[18px] w-[18px] shrink-0 text-[#839297]" />
              <input
                value={postsQuery}
                onChange={(e) => setPostsQuery(e.target.value)}
                placeholder={
                  postsScope === "saved"
                    ? "Search saved posts..."
                    : "Search posts..."
                }
                className="w-full bg-transparent text-base text-[#2B2B2B] outline-none placeholder:text-[14px] placeholder:text-[#839297]"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2.5 no-scrollbar">
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
              <h2 className="mt-4 text-[16px] font-medium text-[#2D2D2D]">
                No {postsScope === "my" ? "posts" : "saved posts"} yet
              </h2>
              <p className="mx-auto mt-2 max-w-[260px] text-[14px] leading-6 text-[#8F98A0]">
                {postsScope === "my"
                  ? "Posts you create in Community will appear here."
                  : "Posts you save from Community will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {profilePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  showShare={postsScope !== "saved"}
                  onOpenPost={(selectedPost) =>
                    router.push(`/community/post/${selectedPost.id}`)
                  }
                  onDeleted={(postId) =>
                    setProfilePosts((prev) =>
                      prev.filter((item) => item.id !== postId),
                    )
                  }
                  onSaveStateChange={(updatedPost, isSaved) => {
                    if (postsScope !== "saved") return;

                    setProfilePosts((prev) => {
                      if (!isSaved) {
                        return prev.filter(
                          (item) => item.id !== updatedPost.id,
                        );
                      }

                      if (prev.some((item) => item.id === updatedPost.id)) {
                        return prev.map((item) =>
                          item.id === updatedPost.id ? updatedPost : item,
                        );
                      }

                      return [updatedPost, ...prev];
                    });
                  }}
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
      <div className="flex h-full flex-col bg-white font-sf-pro-display">
        <header className="flex items-center justify-between  bg-white z-10">
          <button onClick={handleEditProfileBack} className="-ml-3 p-2">
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-[16px] font-medium text-[#2B2B2B]">Edit Profile</h1>
          <div className="-mr-3 w-10" />
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-7 pb-4">
          <div className="flex justify-center">
            <div className="relative">
              <div
                onClick={openPhotoSourceModal}
                className="relative flex h-[125px] w-[125px] cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gray-200 transition-transform active:scale-95"
              >
                {imageLoading && !profileImage && (
                  <UserIcon className="h-16 w-16 text-gray-400" />
                )}
                {(pendingProfileImageUrl || profileImage) && (
                  <Image
                    src={pendingProfileImageUrl || profileImage}
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
              <button
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation();
                  openPhotoSourceModal();
                }}
                className="absolute bottom-0 right-0 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#01C3CF] transition-all active:scale-90 disabled:opacity-50"
              >
                <Camera className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            <div>
              <label className="mb-[5px] block text-[14px] leading-5 text-[#2B2B2B]">
                Username
              </label>
              <input
                type="text"
                value={editData.username}
                disabled
                className="h-10 w-full cursor-not-allowed rounded-full bg-[#F6F6F6] px-[17px] text-base text-[#839297] outline-none"
              />
            </div>
            <div>
              <label className="mb-[5px] block text-[14px] leading-5 text-[#2B2B2B]">
                Display Name
              </label>
              <input
                type="text"
                value={editData.displayName}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    displayName: e.target.value.slice(
                      0,
                      MAX_DISPLAY_NAME_LENGTH,
                    ),
                  })
                }
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                className="h-10 w-full rounded-full bg-[#F6F6F6] px-[17px] text-base text-[#2B2B2B] outline-none focus:ring-2 focus:ring-[#14C3CF]/20"
              />
              <p className="mt-1 text-right text-[12px] leading-4 text-[#839297]">
                {editData.displayName.length}/{MAX_DISPLAY_NAME_LENGTH}
              </p>
            </div>
            <div>
              <label className="mb-[5px] block text-[14px] leading-5 text-[#2B2B2B]">
                Email
              </label>
              <input
                type="email"
                value={editData.email}
                disabled
                className="h-10 w-full cursor-not-allowed rounded-full bg-[#F6F6F6] px-[17px] text-base text-[#839297] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Pinned outside the scroll area, as in the design */}
        <div className="shrink-0 bg-white pt-3">
          <button
            onClick={handleEditProfile}
            disabled={isUploading || !isProfileEditDirty}
            className="flex h-[45px] w-full items-center justify-center rounded-full bg-[#01C3CF] text-[14px] text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isUploading ? (
              <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              "Save Changes"
            )}
          </button>
        </div>

        {profileCropImageSrc && (
          <div className="fixed inset-0 z-50 bg-black/80 px-4 py-6">
            <div className="mx-auto flex h-full max-w-[390px] flex-col rounded-[28px] bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => {
                    setProfileCropImageSrc(null);
                    setProfileCrop({ x: 0, y: 0 });
                    setProfileZoom(1);
                    setProfileCroppedAreaPixels(null);
                  }}
                  className="rounded-full bg-[#F5F5F5] px-3 py-1.5 text-[12px] font-medium text-[#2D2D2D]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleApplyProfileCrop()}
                  className="rounded-full bg-[#14C3CF] px-3 py-1.5 text-[12px] font-medium text-white"
                >
                  Apply
                </button>
              </div>
              <div className="relative flex-1 overflow-hidden rounded-[24px] bg-black">
                <Cropper
                  image={profileCropImageSrc}
                  crop={profileCrop}
                  zoom={profileZoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setProfileCrop}
                  onCropComplete={handleProfileCropComplete}
                  onZoomChange={setProfileZoom}
                />
              </div>
              <div className="pt-4">
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={profileZoom}
                  onChange={(e) =>
                    setProfileZoom(Number.parseFloat(e.target.value))
                  }
                  className="w-full accent-[#14C3CF]"
                />
              </div>
            </div>
          </div>
        )}

        <BottomSheet
          open={showPhotoSourceModal}
          onClose={() => setShowPhotoSourceModal(false)}
          title="Change profile photo"
        >
          <div className="px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            <div className="space-y-2.5 pt-3.5">
              <button
                type="button"
                onClick={() => void openCameraCapture("user")}
                className="flex h-[45px] w-full items-center justify-center rounded-full bg-[#01C3CF] text-[14px] text-white"
              >
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoSourceModal(false);
                  fileInputRef.current?.click();
                }}
                className="flex h-[45px] w-full items-center justify-center rounded-full bg-[#F6F6F6] text-[14px] text-[#2B2B2B]"
              >
                Upload From Device
              </button>
              <button
                type="button"
                onClick={() => setShowPhotoSourceModal(false)}
                className="flex h-[45px] w-full items-center justify-center rounded-full bg-white text-[14px] text-[#839297]"
              >
                Cancel
              </button>
            </div>
          </div>
        </BottomSheet>

        {showCameraCaptureModal && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-[#0E0A08] text-white">
            {!profileCameraError && (
              <div className="absolute inset-0 overflow-hidden">
                <video
                  ref={profileCameraBackdropVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`h-full w-full scale-[1.05] object-cover blur-[10px] brightness-[0.45] ${
                    profileCameraFacingMode === "user" ? "scale-x-[-1]" : ""
                  }`}
                />
              </div>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.2)_22%,rgba(0,0,0,0.24)_78%,rgba(0,0,0,0.34))]" />

            <div className="relative flex h-full min-h-0 flex-col px-5 pb-[max(env(safe-area-inset-bottom),1.1rem)] pt-[max(env(safe-area-inset-top),0.9rem)]">
              <header className="relative flex h-12 items-center justify-between pt-1">
                <div className="flex w-20 justify-start">
                  <button
                    type="button"
                    onClick={closeCameraCaptureModal}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-black/15 text-white transition active:scale-95"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                </div>

                <h3 className="absolute inset-x-0 mx-auto text-center text-[16px] font-medium tracking-wide text-white pointer-events-none">
                  Take Photo
                </h3>

                <div className="flex w-20 justify-end">
                  <p className="text-right text-[14px] font-semibold text-[#00D0E6]">
                    Profile
                  </p>
                </div>
              </header>

              <div className="relative flex min-h-0 flex-1 items-center justify-center py-4">
                <div className="relative aspect-[3/4] h-full w-auto max-h-full max-w-[min(100%,430px)] overflow-hidden rounded-[40px] border-4 border-white bg-transparent shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                  {profileCameraError ? (
                    <div className="flex h-full flex-col items-center justify-center bg-[#1A1715] px-8 text-center">
                      <Camera className="h-10 w-10 text-white/75" />
                      <p className="mt-4 text-[14px] font-medium text-white">
                        Camera unavailable
                      </p>
                      <p className="mt-2 text-[12px] text-white/70">
                        {profileCameraError}
                      </p>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={profileCameraVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`h-full w-full bg-black object-cover ${
                          profileCameraFacingMode === "user"
                            ? "scale-x-[-1]"
                            : ""
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/10" />
                    </>
                  )}

                  {isStartingCamera && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-white" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mx-auto mt-3 w-full max-w-[350px] rounded-[36px] border border-white/10 bg-[#1E1B19]/50 p-3.5 shadow-[0_24px_48px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeCameraCaptureModal();
                      fileInputRef.current?.click();
                    }}
                    className="flex h-12 w-12 items-center justify-center justify-self-start rounded-full border border-white/5 bg-white/10 text-white transition active:scale-95"
                  >
                    <Upload className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCaptureProfilePhoto()}
                    disabled={Boolean(profileCameraError) || isStartingCamera}
                    className="relative mx-3 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-white bg-white/5 transition active:scale-95 disabled:opacity-30"
                  >
                    <div className="h-[60px] w-[60px] rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.3)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void switchProfileCamera()}
                    disabled={isStartingCamera}
                    className="flex h-12 w-12 items-center justify-center justify-self-end rounded-full border border-white/5 bg-white/10 text-white transition active:scale-95 disabled:opacity-40"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDiscardChangesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-[340px] bg-white rounded-[32px] p-6 space-y-6 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center">
                <h3 className="text-[16px] font-medium text-[#2D2D2D]">
                  Discard Changes?
                </h3>
                <button
                  onClick={() => setShowDiscardChangesModal(false)}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <p className="text-[16px] leading-relaxed text-[#8F98A0]">
                You have unsaved changes. If you leave now, they will be lost.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDiscardChangesModal(false)}
                  className="flex-1 h-11 rounded-full bg-[#F5F5F5] text-[16px] font-medium text-[#2D2D2D] hover:bg-[#EBEBEB] active:scale-[0.98] transition-all"
                >
                  Keep Editing
                </button>
                <button
                  onClick={() => {
                    setShowDiscardChangesModal(false);
                    discardProfileEdits();
                  }}
                  className="flex-1 h-11 rounded-full bg-red-500 text-[16px] font-medium text-white shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="shrink-0 bg-white pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <h1 className="text-center text-[16px] font-medium text-[#2B2B2B]">
          Profile
        </h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar bg-white">
        {/* No extra horizontal padding — the protected layout's <main>
            already applies px-4 (16px), which is the reference's margin. */}
        <div className="space-y-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <section className="rounded-[20px] border border-[#C8EEF1] bg-[#E7F9FB] px-3 py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-200 flex items-center justify-center">
                {imageLoading && !profileImage && (
                  <UserIcon className="h-5 w-5 text-gray-400" />
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
              {/* min-w-0 + flex-1 so long names truncate instead of pushing
                  the button off the card. Centered against the avatar. */}
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
                    {username}
                  </h2>
                  {isVerified && (
                    <VerifiedBadge className="h-[15px] w-[15px] shrink-0 text-[#00C3D0]" />
                  )}
                </div>
                <p className="truncate text-[12px] leading-[19px] text-[#839297]">
                  {user?.name || username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/profile?view=edit")}
                className="inline-flex h-7 shrink-0 items-center gap-2 rounded-full bg-[#00C3D0] pl-2 pr-2.5 text-[12px] font-medium text-white"
              >
                <Edit3 className="h-4 w-4" />
                Edit Profile
              </button>
            </div>

          </section>

          <div>
            <p className="mb-2 text-[14px] leading-5 text-[#839297]">Account &amp; Activity</p>
            <MenuGroup>
              <MenuButton
                icon={<UserIcon size={18} strokeWidth={1.75} className="text-[#16A472]" />}
                iconBg="bg-[#E9F8F1]"
                label="Identity Profile"
                description="Manage your identity details"
                onClick={() => router.push("/identity-profile")}
                showDivider={true}
              />
              <MenuButton
                icon={<Crown size={18} strokeWidth={1.75} className="text-[#F08922]" />}
                iconBg="bg-[#FFF3E5]"
                label="Subscription"
                description="Manage your plan & benefits"
                onClick={() => router.push("/subscription")}
                showDivider={true}
              />
              <MenuButton
                icon={<Trophy size={18} strokeWidth={1.75} className="text-[#E3484C]" />}
                iconBg="bg-[#FCECED]"
                label="Your Progress"
                description="Track your Cloak progress"
                onClick={() => router.push("/progress")}
                showDivider={true}
              />
              <MenuButton
                icon={<Flag size={18} strokeWidth={1.75} className="text-[#8A3FD0]" />}
                iconBg="bg-[#F4E9FA]"
                label="My Reports"
                description="View your submitted reports"
                onClick={() => router.push("/my-reports")}
                showDivider={true}
              />
              <MenuButton
                icon={<CirclePlus size={18} strokeWidth={1.75} className="text-[#1497B3]" />}
                iconBg="bg-[#E8F7FA]"
                label="My Posts"
                description="Manage your community posts"
                onClick={() => void openPostsView("My Posts", "my")}
                showDivider={true}
              />
              <MenuButton
                icon={<Bookmark size={18} strokeWidth={1.75} className="text-[#067DB5]" />}
                iconBg="bg-[#E8F3F9]"
                label="Saved Posts"
                description="View your saved posts"
                onClick={() => void openPostsView("Saved Posts", "saved")}
              />
            </MenuGroup>
          </div>

          <div>
            <p className="mb-2 text-[14px] leading-5 text-[#839297]">Verification &amp; Privacy</p>
            <MenuGroup>
              <MenuButton
                icon={<ShieldCheck size={18} strokeWidth={1.75} className="text-[#D74B66]" />}
                iconBg="bg-[#FBEAF0]"
                label="Verification"
                description="Manage your identity verification"
                onClick={handleVerificationClick}
                showDivider={true}
              />
              <MenuButton
                icon={<Shield size={18} strokeWidth={1.75} className="text-[#C98113]" />}
                iconBg="bg-[#FFF4E0]"
                label="Privacy Policy"
                description="Review your privacy & data"
                onClick={() => router.push("/privacy-policy")}
              />
            </MenuGroup>
          </div>

          <div>
            <p className="mb-2 text-[14px] leading-5 text-[#839297]">Account Actions</p>
            <MenuGroup>
              <MenuButton
                icon={<Trash2 size={18} strokeWidth={1.75} className="text-[#FD3B3C]" />}
                iconBg="bg-[#FFF1F1]"
                label="Delete Account"
                description="Permanently remove your account"
                onClick={() => setShowDeleteAccountModal(true)}
                variant="danger"
              />
            </MenuGroup>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-3xl bg-[#FFF6F7] text-[16px] font-medium text-[#F30131]"
          >
            <LogOut className="h-6 w-6" />
            Logout
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-[340px] bg-white rounded-[32px] p-6 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-[16px] font-medium text-[#2D2D2D]">Log Out</h3>
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
                className="flex-1 h-11 rounded-full bg-[#F5F5F5] text-[16px] font-medium text-[#2D2D2D] hover:bg-[#EBEBEB] active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 h-11 rounded-full bg-red-500 text-[16px] font-medium text-white shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all"
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
              <h3 className="text-[16px] font-medium text-[#2D2D2D]">
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

            <p className="text-[14px] leading-relaxed text-[#2D2D2D]">
              This will permanently delete your account, profile, protected
              media, identity verification data, reports, and recent searches.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                className="flex-1 h-11 rounded-full bg-[#F5F5F5] text-[16px] font-medium text-[#2D2D2D] hover:bg-[#EBEBEB] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="flex-1 h-11 rounded-full bg-red-500 text-[16px] font-medium text-white shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center"
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
