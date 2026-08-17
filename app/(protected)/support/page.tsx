"use client";

import { ChevronLeft, Crown, MessageCircle, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  MAX_SUPPORT_MESSAGE_LENGTH,
  MAX_SUPPORT_SUBJECT_LENGTH,
  PLAN_LIMITS,
} from "@/lib/config";
import type { PlanCode } from "@/models/Subscription";

export default function SupportPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const plan: PlanCode = session?.user?.plan || "FREEMIUM";
  const canContactSupport = PLAN_LIMITS[plan].canContactSupport;
  const canSend = subject.trim() && message.trim() && !isSending;

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        toast.error(data?.error || "We couldn't send your message. Please try again.");
        return;
      }

      toast.success("Message sent — our team will follow up by email.");
      setSubject("");
      setMessage("");
      router.back();
    } catch {
      toast.error("We couldn't send your message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between  bg-white z-10">
        <button type="button" onClick={() => router.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">Contact Support</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {status === "loading" ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
          </div>
        ) : !canContactSupport ? (
          <div className="flex flex-col items-center gap-4 pt-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF9FA]">
              <Crown className="h-7 w-7 text-[#14C3CF]" />
            </div>
            <div className="space-y-1.5">
              <p className="text-[17px] font-semibold text-[#2D2D2D]">
                Contact Support is a Cloak Pro perk
              </p>
              <p className="mx-auto max-w-[280px] text-[14px] leading-6 text-[#8F98A0]">
                Upgrade to Cloak Pro to reach our team directly and get priority help.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/subscription/cloak-pro")}
              className="mt-2 w-full max-w-[280px] rounded-full bg-[#14C3CF] px-4 py-3.5 text-[15px] font-medium text-white"
            >
              View Cloak Pro
            </button>
          </div>
        ) : (
          <>
            <p className="mt-5 text-[14px] leading-6 text-[#8F98A0]">
              Tell us what&apos;s going on and our team will get back to you by email.
            </p>

            <div className="mt-5">
              <p className="mb-2 text-[14px] font-medium text-[#2D2D2D]">Subject</p>
              <div className="relative">
                <Type className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Can't complete identity verification"
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value.slice(0, MAX_SUPPORT_SUBJECT_LENGTH))
                  }
                  className="w-full bg-[#F5F5F5] rounded-2xl px-12 pr-5 py-4 outline-none focus:ring-2 focus:ring-[#14C3CF]/20 text-base"
                />
              </div>
              <div className="mt-2 flex justify-end text-sm text-[#8F98A0]">
                {subject.length}/{MAX_SUPPORT_SUBJECT_LENGTH}
              </div>
            </div>

            <div className="mt-1">
              <p className="mb-2 text-[14px] font-medium text-[#2D2D2D]">Message</p>
              <div className="relative">
                <MessageCircle className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                <textarea
                  placeholder="Describe the problem..."
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value.slice(0, MAX_SUPPORT_MESSAGE_LENGTH))
                  }
                  rows={8}
                  className="w-full bg-[#F5F5F5] rounded-2xl px-12 pr-5 py-4 outline-none focus:ring-2 focus:ring-[#14C3CF]/20 resize-none text-base"
                />
              </div>
              <div className="mt-2 flex justify-end text-sm text-[#8F98A0]">
                {message.length}/{MAX_SUPPORT_MESSAGE_LENGTH}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-[#14C3CF] text-[16px] font-medium text-white disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send Message"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
