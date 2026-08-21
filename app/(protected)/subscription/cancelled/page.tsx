"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { SubscriptionHeader, SubscriptionScreenShell } from "../_components/SubscriptionUI";

export default function SubscriptionCancelledPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/subscription?checkout=cancelled");
  }, [router]);

  return (
    <SubscriptionScreenShell>
      <SubscriptionHeader />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F05B5B]/10">
          <XCircle className="h-8 w-8 text-[#F05B5B]" />
        </div>
        <h1 className="text-[22px] font-semibold text-[#111827]">Checkout cancelled</h1>
        <p className="mt-3 max-w-[300px] text-[15px] leading-6 text-[#8F98A0]">
          No payment was made. You&apos;re still on your current plan.
        </p>
        <button
          type="button"
          onClick={() => router.push("/subscription")}
          className="mt-8 w-full max-w-[280px] rounded-full bg-[#14C3CF] px-4 py-4 text-[15px] font-medium text-white"
        >
          Back to Subscription
        </button>
      </div>
    </SubscriptionScreenShell>
  );
}
