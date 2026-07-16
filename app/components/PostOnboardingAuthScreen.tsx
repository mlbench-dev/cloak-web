"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";
import { useMemo, useState } from "react";

type PostOnboardingAuthScreenProps = {
  onEmailSubmit?: (email: string) => void;
  onGoogleSignIn?: () => void;
  error?: string | null;
  isLoading?: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function GoogleMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.718v2.258h2.908c1.702-1.566 2.684-3.874 2.684-6.616Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.179l-2.908-2.258c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.712A5.41 5.41 0 0 1 3.682 9c0-.594.102-1.17.282-1.712V4.956H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.578c1.321 0 2.507.455 3.44 1.347l2.58-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .957 4.956l3.007 2.332C4.672 5.161 6.656 3.578 9 3.578Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function PostOnboardingAuthScreen({
  onEmailSubmit,
  onGoogleSignIn,
  error,
  isLoading,
}: PostOnboardingAuthScreenProps) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmedEmail = email.trim();
  const isValidEmail = useMemo(
    () => EMAIL_REGEX.test(trimmedEmail),
    [trimmedEmail],
  );
  const showFormatError = touched && trimmedEmail.length > 0 && !isValidEmail;

  const handleSubmit = () => {
    if (isLoading) return;
    if (!isValidEmail) {
      setTouched(true);
      return;
    }
    onEmailSubmit?.(trimmedEmail);
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    if (onGoogleSignIn) {
      onGoogleSignIn();
    } else {
      await signIn("google", { callbackUrl: "/dashboard" });
    }
  };

  return (
    <main className="font-sf-pro-display flex h-full justify-center bg-[#F5F5F5] text-[#2D2D2D]">
      <div className="w-full max-w-[390px] px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex flex-col items-start">
          <div className="mb-9">
            <Image
              src="/images/logo/cloakLogo.svg"
              alt="Cloak logo"
              width={34}
              height={39}
              priority
            />
          </div>

          <div className="mb-8 space-y-2">
            <h1 className="text-[24px] font-[600] leading-[1.2] tracking-[-0.03em] text-[#2D2D2D] 2xl:text-[30px]">
              Continue with Email
            </h1>
            <p className="max-w-[260px] text-[14px] leading-6 text-[#8F98A0] 2xl:max-w-[320px] 2xl:text-[16px]">
              We will send you a one-time password to your email.
            </p>
          </div>

          <div className="w-full space-y-7">
            {error && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-2 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-[#FF3B30]/10">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#FF3B30] text-[#FF3B30] text-[12px] font-bold">
                    !
                  </div>
                  <p className="text-[13px] font-medium text-[#2D2D2D]">
                    {error}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2.5">
              <label
                htmlFor="email"
                className="block text-[15px] font-medium text-[#3E454B] 2xl:text-[17px]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="email@service.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setTouched(true)}
                className={`h-14 w-full rounded-[18px] border bg-[#ECECEC] px-5 text-[16px] text-[#2D2D2D] outline-none placeholder:text-[#A7ADB2] focus:border-[#14C3CF] 2xl:h-16 2xl:text-[18px] ${
                  showFormatError ? "border-[#FF3B30]" : "border-transparent"
                }`}
              />
              {showFormatError && (
                <p className="text-[13px] text-[#FF3B30]">
                  Enter a valid email like email@service.com
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !isValidEmail}
              className="flex h-14 w-full items-center justify-center rounded-full bg-[#14C3CF] text-[18px] font-medium text-white shadow-[0_10px_24px_rgba(20,195,207,0.22)] disabled:opacity-50 2xl:h-16 2xl:text-[20px]"
            >
              {isLoading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "Send OTP"
              )}
            </button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-[#E3E3E3]" />
              <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#949CA2] 2xl:text-[13px]">
                OR
              </span>
              <div className="h-px flex-1 bg-[#E3E3E3]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#ECECEC] text-[16px] font-medium text-[#2D2D2D] disabled:opacity-50 2xl:h-16 2xl:text-[18px]"
            >
              <GoogleMark />
              <span>Sign In With Google</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
