"use client";

import { signIn, useSession } from "next-auth/react";
import { signOutToLogin } from "@/lib/signOutToLogin";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import toast from "react-hot-toast";
import IdentityVerificationStep from "./auth/IdentityVerificationStep";
import OTPVerification from "./auth/OTPVerification";
import ProfilePicStep from "./auth/ProfilePicStep";
import UsernameStep from "./auth/UsernameStep";
import OnboardingStepLayout from "./OnboardingStepLayout";
import PostOnboardingAuthScreen from "./PostOnboardingAuthScreen";
import SplashScreen from "./SplashScreen";

const STEPS = [
  {
    logoSrc: "/images/icons/cloakLogo.svg",
    headline: "CLOAK",
    subheadline: "Detect where you appear online",
    heroSrc: "/images/splashScreen/compressed/first.webp",
    heroAlt: "Illustration for uploading identity",
    title: "Upload identity",
    description:
      "Securely provide reference images to create your digital cloak.",
    buttonLabel: "Next",
  },
  {
    logoSrc: "/images/icons/cloakLogo.svg",
    headline: "CLOAK",
    subheadline: "Detect where you appear online",
    heroSrc: "/images/splashScreen/compressed/second.webp",
    heroAlt: "Illustration for community detection",
    title: "Community detects content",
    description: "Our network scans and reports where you appear online.",
    buttonLabel: "Next",
  },
  {
    logoSrc: "/images/icons/cloakLogo.svg",
    headline: "CLOAK",
    subheadline: "Detect where you appear online",
    heroSrc: "/images/splashScreen/compressed/third.webp",
    heroAlt: "Illustration for notifications and rewards",
    title: "Get notified & rewarded",
    description:
      "Take control of your privacy and earn points for helping others.",
    buttonLabel: "Next",
  },
] as const;

const getIdentityDraftStorageKey = (scopeKey?: string | null) =>
  `cloak-identity-verification-draft:${scopeKey || "anonymous"}`;

// authStep round-trips through the URL so a refresh on the OTP screen
// re-lands there, but the email itself was only ever in memory — refreshing
// wiped it. Session storage survives the refresh without putting an email
// address in the URL/history.
const PENDING_OTP_EMAIL_KEY = "cloak-pending-otp-email";

// The resend countdown is stored as an absolute deadline (not "seconds
// remaining") so a page refresh can recompute how much time is actually
// left instead of resetting the timer back to the full duration.
const OTP_RESEND_SECONDS = 45;
const OTP_RESEND_DEADLINE_KEY = "cloak-otp-resend-deadline";

function readStoredResendDeadline(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(OTP_RESEND_DEADLINE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new window.Image();

    const finish = () => {
      image.onload = null;
      image.onerror = null;
      resolve();
    };

    image.onload = finish;
    image.onerror = finish;
    image.src = src;

    if (image.complete) {
      finish();
    }
  });
}

export type AuthStep =
  | "EMAIL"
  | "OTP"
  | "USERNAME"
  | "PROFILE_PIC"
  | "IDENTITY"
  | "COMPLETED";

function HomeFlowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAuthStep = searchParams.get("authStep") as AuthStep | null;
  const { data: session, status, update } = useSession();
  const [showSplash, setShowSplash] = useState(status === "loading");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [authStep, setAuthStep] = useState<AuthStep | null>(null);
  const [email, setEmail] = useState("");
  const [otpResendAvailableAt, setOtpResendAvailableAt] = useState<number>(
    readStoredResendDeadline,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToAuthStep = useCallback(
    (nextStep: AuthStep) => {
      setAuthStep(nextStep);
      setShowSplash(false);
      router.replace(`/?authStep=${nextStep}`);
    },
    [router],
  );

  // Handle initial authStep from URL (for logout redirect)
  useEffect(() => {
    if (requestedAuthStep) {
      setAuthStep(requestedAuthStep);
      setShowSplash(false);

      if (requestedAuthStep === "OTP") {
        const storedEmail = window.sessionStorage.getItem(
          PENDING_OTP_EMAIL_KEY,
        );
        if (storedEmail) {
          setEmail((prev) => prev || storedEmail);
        }
      }
    }
  }, [requestedAuthStep]);

  // Handle session-based redirection/onboarding
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const user = session.user as any;

      if ((session as any).sessionExpired || user.sessionExpired || !user.id) {
        void signOutToLogin();
        return;
      }

      setUserId(user.id);

      // Honor an explicit step from the URL before falling back to inferred onboarding.
      if (
        requestedAuthStep &&
        requestedAuthStep !== "EMAIL" &&
        requestedAuthStep !== "OTP"
      ) {
        if (authStep !== requestedAuthStep) {
          setAuthStep(requestedAuthStep);
        }
        setShowSplash(false);
        return;
      }

      // If we have an explicit authStep, we stay there.
      // This prevents session updates from kicking us out of the onboarding flow.
      if (authStep && authStep !== "EMAIL" && authStep !== "OTP") {
        setShowSplash(false);
        return;
      }

      // Returning users go straight to the dashboard.
      if (user.username) {
        router.replace("/dashboard");
        setShowSplash(false);
      } else {
        goToAuthStep("USERNAME");
      }
    } else if (status === "loading") {
      // Only show splash on initial load, not during session updates
      if (!authStep) {
        setShowSplash(true);
      }
    }
  }, [status, session, router, authStep, requestedAuthStep, goToAuthStep]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Stay on this page after sign in to let the useEffect handle the routing
      const result = await signIn("google", { redirect: false });
      if (result?.error) {
        setError("Failed to sign in with Google. Please try again.");
      }
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const splashStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      setShowSplash(false);
      return;
    }

    splashStartRef.current = Date.now();
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const firstStepAssets = Array.from(
      new Set([STEPS[0]?.logoSrc, STEPS[0]?.heroSrc].filter(Boolean)),
    );

    const remainingAssets = Array.from(
      new Set(
        STEPS.slice(1)
          .flatMap((step) => [step.logoSrc, step.heroSrc])
          .filter(Boolean),
      ),
    );

    const hideSplash = () => {
      const elapsed = Date.now() - (splashStartRef.current ?? 0);
      const minDelay = 3000;
      const remainingTime = Math.max(minDelay - elapsed, 0);

      if (remainingTime <= 0) {
        setShowSplash(false);
      } else {
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            setShowSplash(false);
          }
        }, remainingTime);
      }
    };

    Promise.all(firstStepAssets.map((src) => preloadImage(src)))
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          hideSplash();
        }
      });

    remainingAssets.forEach((src) => {
      void preloadImage(src);
    });

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [status]);

  const handleEmailSubmit = async (submittedEmail: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail }),
      });
      const data = await response.json();
      if (response.ok) {
        setEmail(submittedEmail);
        window.sessionStorage.setItem(PENDING_OTP_EMAIL_KEY, submittedEmail);
        const deadline = Date.now() + OTP_RESEND_SECONDS * 1000;
        window.sessionStorage.setItem(
          OTP_RESEND_DEADLINE_KEY,
          String(deadline),
        );
        setOtpResendAvailableAt(deadline);
        goToAuthStep("OTP");
        toast.success("OTP sent to your email! Please check your inbox.", {
          id: "otp-sent",
          duration: 2000,
        });
      } else {
        setError(data.error || "Failed to send OTP. Please try again.");
      }
    } catch (error) {
      console.error("Failed to send OTP", error);
      setError(
        "Failed to connect to the server. Please check your connection.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerify = async (otp: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await response.json();
      if (response.ok) {
        setUserId(data.user.id);
        window.sessionStorage.removeItem(PENDING_OTP_EMAIL_KEY);
        window.sessionStorage.removeItem(OTP_RESEND_DEADLINE_KEY);

        // Use NextAuth signIn to create a session for the OTP user
        // This ensures the session is established and data is synced
        await signIn("credentials", {
          email,
          redirect: false,
        });

        if (data.user.username) {
          router.replace("/dashboard");
        } else {
          goToAuthStep("USERNAME");
        }
      } else {
        setError(data.error || "Invalid verification code.");
      }
    } catch (error) {
      console.error("Failed to verify OTP", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // The email field on the OTP screen is disabled by design (it shouldn't
  // be editable in place — a changed email needs a new code sent to it),
  // so this is the way back if someone mistyped it.
  const handleChangeEmail = () => {
    setError(null);
    setEmail("");
    window.sessionStorage.removeItem(PENDING_OTP_EMAIL_KEY);
    window.sessionStorage.removeItem(OTP_RESEND_DEADLINE_KEY);
    setOtpResendAvailableAt(0);
    goToAuthStep("EMAIL");
  };

  const handleUsernameSubmit = async (username: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username }),
      });
      const data = await response.json();
      if (response.ok) {
        // Move to the next step FIRST
        goToAuthStep("PROFILE_PIC");
        // Then update the session in the background
        update({ username });
      } else {
        setError(data.error || "Failed to update username.");
      }
    } catch (error) {
      console.error("Failed to update username", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfilePicSubmit = async (file: File | null) => {
    if (!file) {
      goToAuthStep("IDENTITY");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Upload to Local Storage via API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "profile");
      formData.append("userId", userId || "");

      const uploadRes = await fetch("/api/auth/upload", {
        method: "POST",
        body: formData,
      });

      const { url: downloadURL } = await uploadRes.json();

      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, image: downloadURL }),
      });
      const data = await response.json();
      if (response.ok) {
        // Move to the next step FIRST
        goToAuthStep("IDENTITY");
        // Then update the session in the background
        update({ image: downloadURL });
      } else {
        setError(data.error || "Failed to upload profile picture.");
      }
    } catch (error) {
      console.error("Failed to upload profile pic", error);
      setError("An unexpected error occurred during upload.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdentitySubmit = async (data: {
    documentType: string;
    files: File[];
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      // Upload files to Local Storage via API
      const uploadPromises = data.files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "identity");
        formData.append("userId", userId || "");

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
        ...((data as { existingUrls?: string[] }).existingUrls || []),
        ...uploadedDocumentUrls,
      ];

      const response = await fetch("/api/auth/identity-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          documentType: data.documentType,
          documentUrls,
        }),
      });
      const resData = await response.json();
      if (response.ok) {
        try {
          window.sessionStorage.setItem(
            getIdentityDraftStorageKey(userId),
            JSON.stringify({
              documentType: data.documentType,
              documentUrls,
            }),
          );
        } catch (storageError) {
          console.error("Failed to persist identity draft:", storageError);
        }

        // Update the session status
        await update({
          identityVerificationStatus: "PENDING",
          documentType: data.documentType,
        });
        router.replace("/reference-media?mode=onboarding");
        return false;
      } else {
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
      setIsLoading(false);
    }
  };

  if (showSplash) {
    return <SplashScreen />;
  }

  if (authStep === "EMAIL") {
    return (
      <PostOnboardingAuthScreen
        onEmailSubmit={handleEmailSubmit}
        onGoogleSignIn={handleGoogleSignIn}
        error={error}
        isLoading={isLoading}
      />
    );
  }

  if (authStep === "OTP") {
    return (
      <OTPVerification
        email={email}
        onVerify={handleOTPVerify}
        onResend={() => handleEmailSubmit(email)}
        onChangeEmail={handleChangeEmail}
        onGoogleSignIn={handleGoogleSignIn}
        error={error}
        isLoading={isLoading}
        resendAvailableAt={otpResendAvailableAt}
      />
    );
  }

  if (authStep === "USERNAME") {
    const user = session?.user as any;
    return (
      <UsernameStep
        onContinue={handleUsernameSubmit}
        error={error}
        initialBase={user?.name || user?.email?.split("@")[0] || ""}
        isLoading={isLoading}
      />
    );
  }

  if (authStep === "PROFILE_PIC") {
    return (
      <ProfilePicStep
        onContinue={handleProfilePicSubmit}
        onSkip={() => goToAuthStep("IDENTITY")}
        error={error}
      />
    );
  }

  if (authStep === "IDENTITY") {
    const user = session?.user as any;
    return (
      <IdentityVerificationStep
        onSkip={() => router.replace("/dashboard")}
        onSubmit={handleIdentitySubmit}
        onContinueToDashboard={() => router.replace("/dashboard")}
        error={error}
        status={user?.identityVerificationStatus}
        isLoading={isLoading}
        draftScopeKey={user?.id || userId}
      />
    );
  }

  const currentStep = STEPS[currentStepIndex];

  return (
    <OnboardingStepLayout
      // Forces a remount per step so the fade-in re-triggers on every
      // "Next" click too, not just the first entrance from the splash
      // screen — otherwise only the initial mount would ever animate.
      key={currentStepIndex}
      {...currentStep}
      onNext={() => {
        if (currentStepIndex === STEPS.length - 1) {
          goToAuthStep("EMAIL");
          return;
        }

        setCurrentStepIndex((stepIndex) => stepIndex + 1);
      }}
      currentStep={currentStepIndex + 1}
      totalSteps={STEPS.length}
    />
  );
}

export default function HomeFlow() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <HomeFlowContent />
    </Suspense>
  );
}
