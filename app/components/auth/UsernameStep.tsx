"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { debounce } from "lodash";

type UsernameStepProps = {
  onContinue: (username: string) => void;
  error?: string | null;
  initialBase?: string;
  isLoading?: boolean;
};

export default function UsernameStep({
  onContinue,
  error,
  initialBase = "",
  isLoading = false,
}: UsernameStepProps) {
  const [username, setUsername] = useState("");
  const [isTaken, setIsTaken] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const checkAvailability = useCallback(
    debounce(async (val: string) => {
      if (val.length < 3) {
        setIsValid(false);
        setIsTaken(false);
        return;
      }
      setIsChecking(true);
      try {
        const res = await fetch(`/api/auth/username-check?username=${val}`);
        const data = await res.json();
        setIsTaken(!data.available);
        setIsValid(data.available);
      } catch (err) {
        console.error("Failed to check availability", err);
      } finally {
        setIsChecking(false);
      }
    }, 500),
    [],
  );

  const fetchSuggestions = async (base: string) => {
    try {
      const res = await fetch(
        `/api/auth/username-suggestions?base=${base || "user"}`,
      );
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error("Failed to fetch suggestions", err);
    }
  };

  useEffect(() => {
    if (username.length >= 3) {
      fetchSuggestions(username);
    } else {
      fetchSuggestions(initialBase);
    }
  }, [username, initialBase]);

  const handleUsernameChange = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
    setUsername(cleaned);
    if (cleaned.length >= 3) {
      checkAvailability(cleaned);
    } else {
      setIsValid(false);
      setIsTaken(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUsername(suggestion);
    setIsValid(true);
    setIsTaken(false);
  };

  return (
    <main className="font-sf-pro-display relative flex h-full justify-center bg-[#F5F5F5] text-[#2D2D2D]">
      {(isTaken || error) && (
        <div className="absolute top-6 left-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-[#FF3B30]/10">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#FF3B30] text-[#FF3B30] text-[12px] font-bold">
              !
            </div>
            <p className="text-[13px] font-medium text-[#2D2D2D]">
              {error || "This username is already taken, please try again"}
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-[390px] px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex flex-col items-start h-full">
          <div className="flex w-full items-center justify-between mb-9">
            <Image
              src="/images/logo/cloakLogo.svg"
              alt="Cloak logo"
              width={34}
              height={39}
              priority
            />
            <span className="text-[13px] font-semibold tracking-wider text-[#14C3CF]">
              STEP 1/3
            </span>
          </div>

          <div className="mb-8 space-y-2">
            <h1 className="text-[24px] font-[600] leading-[1.2] tracking-[-0.03em] text-[#2D2D2D] 2xl:text-[30px]">
              Create a Username
            </h1>
            <p className="max-w-[280px] text-[14px] leading-6 text-[#8F98A0] 2xl:max-w-[320px] 2xl:text-[16px]">
              Create a username so its easy for people to mention you in the
              platform
            </p>
          </div>

          <div className="w-full space-y-8">
            <div className="space-y-2.5">
              <label
                htmlFor="username"
                className="block text-[15px] font-medium text-[#3E454B] 2xl:text-[17px]"
              >
                Username
              </label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[16px] font-bold text-[#2D2D2D]">
                  @
                </span>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter a username"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`h-14 w-full rounded-[18px] border bg-[#ECECEC] pl-10 pr-12 text-[16px] text-[#2D2D2D] outline-none transition-all 2xl:h-16 2xl:text-[18px] ${
                    isTaken
                      ? "border-[#FF3B30] bg-white"
                      : isValid
                        ? "border-transparent bg-[#ECECEC]"
                        : "border-transparent"
                  } focus:border-[#14C3CF]`}
                />
                {isChecking && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#14C3CF] border-t-transparent" />
                  </div>
                )}
                {isValid && !isTaken && !isChecking && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#14C3CF]">
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
                {isTaken && !isChecking && (
                  <button
                    onClick={() => setUsername("")}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[#FF3B30]"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M15 5L5 15M5 5L15 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-[13px] font-bold text-[#2D2D2D]">
                  Suggested usernames
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="rounded-full bg-[#ECECEC] px-4 py-2 text-[13px] font-medium text-[#2D2D2D] hover:bg-[#E0E0E0] transition-colors"
                    >
                      @{suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onContinue(username)}
                disabled={!isValid || isTaken || isChecking || isLoading}
                className="flex h-14 w-full items-center justify-center rounded-full bg-[#14C3CF] text-[18px] font-medium text-white shadow-[0_10px_24px_rgba(20,195,207,0.22)] disabled:opacity-50 disabled:shadow-none transition-all 2xl:h-16 2xl:text-[20px]"
              >
                {isLoading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
