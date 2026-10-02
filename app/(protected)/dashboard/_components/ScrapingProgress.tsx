"use client";

import { ChevronLeft, Radar } from "lucide-react";
import { useEffect, useState } from "react";

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Full-screen takeover shown while the real "Scan Now" call
// (POST /api/fetch-urls) is in flight. There's no streaming progress from
// the CV service — it's a single request that resolves once — so
// Post Found/Images extracted are simulated motion to show something is
// happening, not a real running count. Only Time Elapsed and the
// complete/incomplete state are real.
export default function ScrapingProgress({
  isComplete,
  onBack,
  onOk,
}: {
  isComplete: boolean;
  // Both stay enabled while the scan is still running — it carries on in
  // the background either way.
  onBack: () => void;
  onOk: () => void;
}) {
  const [postsFound, setPostsFound] = useState(0);
  const [imagesExtracted, setImagesExtracted] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setPostsFound((prev) => (prev < 60 ? prev + 1 : prev));
      setImagesExtracted((prev) => (prev < 50 ? prev + 1 : prev));
      setElapsedSeconds((prev) => prev + 1);
    }, 300);
    return () => clearInterval(interval);
  }, [isComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white px-4 pt-4 font-sf-pro-display">
      <header className="flex items-center bg-white">
        <button
          type="button"
          onClick={onBack}
          className="-ml-3 p-2"
        >
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
      </header>

      <main className="mt-2 flex-1 min-h-0 overflow-y-auto pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="rounded-[32px] bg-gradient-to-b from-[#EDFBFC] to-white px-[15px] pb-[15px] pt-[27px]">
          <div className="relative mx-auto flex h-[130px] w-[130px] items-center justify-center">
            <svg
              className={`absolute inset-0 h-full w-full -rotate-90 ${isComplete ? "" : "animate-spin"}`}
              style={{ animationDuration: "2.5s" }}
              viewBox="0 0 100 100"
            >
              <circle cx="50" cy="50" r="44" fill="none" stroke="#F1EDEE" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#00C2CE"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={isComplete ? 0 : 2 * Math.PI * 44 * 0.75}
              />
            </svg>
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#00C2CE]">
              <Radar className="h-[22px] w-[22px] text-white" />
            </div>
          </div>

          <h1 className="mt-8 text-center text-[24px] font-medium leading-[30px] text-[#0B1014]">
            {isComplete ? "Scan Complete" : "Scraping Posts"}
          </h1>
          <p className="mx-auto mt-3 max-w-[250px] text-center text-[12px] leading-4 text-[#829194]">
            {isComplete
              ? "We've finished scanning your monitored profiles and communities."
              : "This may take a few minutes depending on the number of posts."}
          </p>

          <div className="mt-10 rounded-[20px] border border-[#E0E0E0] bg-white px-4 pb-3 pt-3.5">
            <p className="text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
              Detection Information
            </p>
            <div className="mt-2.5 space-y-[9px]">
              <div className="flex items-center justify-between text-[14px] leading-5">
                <p className="text-[#839297]">Post Found</p>
                <p className="text-[#2B2B2B]">{postsFound}</p>
              </div>
              <div className="flex items-center justify-between text-[14px] leading-5">
                <p className="text-[#839297]">Images extracted</p>
                <p className="text-[#2B2B2B]">{imagesExtracted}</p>
              </div>
              <div className="flex items-center justify-between text-[14px] leading-5">
                <p className="text-[#839297]">Time Elapsed</p>
                <p className="text-[#2B2B2B]">{formatElapsed(elapsedSeconds)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onOk}
            className="h-11 w-full rounded-full bg-[#00C2CE] text-[16px] font-medium text-white"
          >
            Ok
          </button>
        </div>
      </main>
    </div>
  );
}
