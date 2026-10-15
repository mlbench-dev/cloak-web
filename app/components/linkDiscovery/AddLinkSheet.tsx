"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import BottomSheet from "@/app/components/BottomSheet";

// Add one watched link (POST /api/cloak-watch/links — same rules as Known
// Websites: Instagram/Facebook/X only, plan limit). Used by Cloak Watch's
// "Add Link" and by the "add your own links?" prompt after a user rejects
// every suggested link.
export default function AddLinkSheet({
  open,
  onClose,
  onAdded,
  title = "Add Link",
  intro,
  limitText,
  dismissLabel,
}: {
  open: boolean;
  onClose: () => void;
  // scrapeStarted: the link went straight into a scrape.
  onAdded: (result: { scrapeStarted: boolean }) => void;
  title?: string;
  intro?: string;
  // e.g. "3 / 20 links on your plan".
  limitText?: string;
  // Shows a secondary button (e.g. "Maybe later") that just closes.
  dismissLabel?: string;
}) {
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (adding || !link.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/cloak-watch/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error || "Couldn't add the link.");
        return;
      }
      setLink("");
      toast.success("Link added to Cloak Watch");
      onAdded({ scrapeStarted: Boolean(data.scrapeStarted) });
    } catch {
      setError("Couldn't add the link.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      dismissible={!adding}
      onExited={() => setError(null)}
    >
      <div className="px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4">
        {intro && <p className="mb-3 text-[13px] leading-5 text-[#839297]">{intro}</p>}
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
          placeholder="Paste an Instagram, Facebook or X profile link"
          className="h-[42px] w-full rounded-xl bg-[#F5F5F5] px-3.5 text-[14px] text-[#2B2B2B] outline-none placeholder:text-[#A7ADB2] focus:ring-2 ring-[#14C3CF]/20"
        />
        {error ? (
          <p className="mt-1.5 text-[12px] leading-4 text-[#F30131]">{error}</p>
        ) : (
          limitText && <p className="mt-1.5 text-[11px] leading-4 text-[#839297]">{limitText}</p>
        )}
        <div className="mt-5 flex items-center gap-2.5">
          {dismissLabel && (
            <button
              type="button"
              onClick={onClose}
              disabled={adding}
              className="h-12 flex-1 rounded-full bg-[#F5F5F5] text-[15px] text-[#839297] disabled:opacity-50"
            >
              {dismissLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={adding || !link.trim()}
            className="h-12 flex-1 rounded-full bg-[#14C3CF] text-[16px] text-white disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add Link"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
