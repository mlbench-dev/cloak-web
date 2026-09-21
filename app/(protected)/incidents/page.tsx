"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlatformIcon } from "./_components/IncidentUI";
import { detectPlatform } from "@/lib/platform";

interface ScanResultsResponse {
  success: boolean;
  urls: string[];
  updatedAt: string | null;
}

export default function IncidentsPage() {
  const router = useRouter();
  const [urls, setUrls] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scan-results")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ScanResultsResponse | null) => {
        if (cancelled || !data?.success) return;
        setUrls(data.urls);
        setUpdatedAt(data.updatedAt);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between bg-white z-10">
        <button type="button" onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">Detected Links</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto py-3 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {updatedAt && (
          <p className="mb-3 text-[12px] text-[#8F98A0]">
            Last scanned {new Date(updatedAt).toLocaleString()}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : urls.length > 0 ? (
          <div className="space-y-3">
            {urls.map((url) => (
              <Link
                key={url}
                href={`/incidents/${encodeURIComponent(url)}`}
                className="block"
              >
                <div className="flex items-center gap-3 rounded-2xl bg-[#F5F5F5] px-3.5 py-3">
                  <PlatformIcon platform={detectPlatform(url)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[#2D2D2D]">
                      {url}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#8F98A0]">
                      Pending review
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#B5BEC4]" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-[13px] text-[#8F98A0]">
            No links detected yet
          </p>
        )}
      </main>
    </div>
  );
}
