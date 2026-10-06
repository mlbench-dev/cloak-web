"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PlatformIcon } from "./_components/IncidentUI";
import { detectPlatform } from "@/lib/platform";

interface ScanResultsResponse {
  success: boolean;
  urls: string[];
  updatedAt: string | null;
  lastScanTriggeredAt: string | null;
}

interface IdentityProfileResponse {
  success: boolean;
  profile: { fullName?: string } | null;
}

// Shows a friendly hostname ("www.instagram.com") instead of the full
// profile path — this level is about the link/account itself, not an
// individual post.
function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function IncidentsPage() {
  const router = useRouter();
  const [urls, setUrls] = useState<string[]>([]);
  const [scanInProgress, setScanInProgress] = useState(false);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scan-results")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ScanResultsResponse | null) => {
        if (cancelled || !data?.success) return;
        setUrls(data.urls);
        // A scan is "in progress" when it was requested more recently than
        // the last completed result set landed (or no results exist yet).
        setScanInProgress(
          !!data.lastScanTriggeredAt &&
            (!data.updatedAt ||
              new Date(data.lastScanTriggeredAt) > new Date(data.updatedAt)),
        );
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/identity-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: IdentityProfileResponse | null) => {
        if (!cancelled && data?.success) {
          setSubjectName(data.profile?.fullName || null);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelected(new Set());
  };

  const toggleSelected = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const allSelected = selected.size === urls.length && urls.length > 0;
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(urls));
  };

  const handleDelete = async () => {
    if (selected.size === 0 || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/fetch-urls", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: Array.from(selected) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Couldn't delete selected links.");
        return;
      }
      setUrls((prev) => prev.filter((url) => !selected.has(url)));
      setSelected(new Set());
      setSelectMode(false);
      toast.success("Removed from Cloak Watch");
    } catch {
      toast.error("Couldn't delete selected links.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between bg-white z-10">
        <button type="button" onClick={() => router.back()} className="-ml-3 p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-[16px] font-medium text-[#2B2B2B]">Cloak Watch</h1>
        {urls.length > 0 ? (
          <button
            type="button"
            onClick={selectMode ? toggleSelectAll : toggleSelectMode}
            className="pl-2 text-[14px] text-[#00C2CE]"
          >
            {selectMode ? (allSelected ? "Deselect all" : "Select all") : "Select"}
          </button>
        ) : (
          <div className="-mr-3 w-10" />
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto pt-5 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {scanInProgress && (
          <div className="mb-4 rounded-3xl bg-[#E9FEFF] px-2.5 pb-3 pt-2">
            <p className="px-0.5 text-[12px] leading-4 text-[#2B2B2B]">Scraping is in Progress</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#00C2CE]" />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : urls.length > 0 ? (
          <div className="space-y-3">
            {urls.map((url) => {
              const isSelected = selected.has(url);
              const row = (
                <div
                  className={`flex h-14 items-center gap-3 rounded-2xl bg-[#F6F6F6] px-2.5 ${
                    selectMode && isSelected
                      ? "ring-[1.5px] ring-[#00C2CE] shadow-[0_0_0_4px_rgba(0,194,206,0.12)]"
                      : ""
                  }`}
                >
                  {/* radio + icon sit closer together (9px) than the row's
                      12px gap, per the reference */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    {selectMode && (
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                          isSelected ? "border-[#00C2CE]" : "border-[#A7AAB1]"
                        }`}
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#00C2CE]" />
                        )}
                      </span>
                    )}
                    <PlatformIcon platform={detectPlatform(url)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] leading-[22px] text-[#2B2B2B]">
                      {hostnameLabel(url)}
                    </p>
                    <p className="truncate text-[12px] leading-4 text-[#839297]">
                      {subjectName || "Pending review"}
                    </p>
                  </div>
                  <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#2B2B2B]" />
                </div>
              );

              return selectMode ? (
                <button
                  key={url}
                  type="button"
                  onClick={() => toggleSelected(url)}
                  className="block w-full text-left"
                >
                  {row}
                </button>
              ) : (
                <Link key={url} href={`/cloak-watch/${encodeURIComponent(url)}`} className="block">
                  {row}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="py-10 text-center text-[12px] text-[#839297]">
            No links detected yet
          </p>
        )}
      </main>

      {selectMode && (
        <div className="pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={selected.size === 0 || deleting}
            className="h-11 w-full rounded-full bg-[#FC383A] text-[16px] font-medium text-white disabled:opacity-50"
          >
            {deleting ? "Deleting..." : `Delete (${selected.size})`}
          </button>
        </div>
      )}
    </div>
  );
}
