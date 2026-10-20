"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2 } from "lucide-react";
import { SubscriptionHeader, SubscriptionScreenShell } from "../_components/SubscriptionUI";

// PayFast's browser redirect here can arrive before the server-to-server
// ITN has finished updating the plan — this page doesn't assume the plan
// is live yet, it just nudges the session to refresh once (which will
// pick up the new plan once the ITN has landed, thanks to the
// dbRefreshedAt reset in lib/auth.ts's jwt() callback) and lets the user
// head back in either case.
export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const { update } = useSession();
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    void update().finally(() => setRefreshed(true));
  }, [update]);

  return (
    <SubscriptionScreenShell>
      <SubscriptionHeader backHref="/profile" />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#1CCF84]/10">
          <CheckCircle2 className="h-8 w-8 text-[#1CCF84]" />
        </div>
        <h1 className="text-[22px] font-semibold text-[#111827]">Payment received</h1>
        <p className="mt-3 max-w-[300px] text-[14px] leading-6 text-[#8F98A0]">
          {refreshed
            ? "Your plan is being activated. It can take a moment to reflect everywhere."
            : "Confirming your payment..."}
        </p>
        {/* replace, not push: history behind this page is the PayFast
            checkout, so it must not stay reachable via back. */}
        <button
          type="button"
          onClick={() => router.replace("/dashboard")}
          className="mt-8 w-full max-w-[280px] rounded-full bg-[#14C3CF] px-4 py-2.5 text-[16px] font-medium text-white"
        >
          Go to Dashboard
        </button>
        <button
          type="button"
          onClick={() => router.replace("/subscription?checkout=success")}
          className="mt-3 w-full max-w-[280px] rounded-full bg-[#F6F6F6] px-4 py-2.5 text-[16px] font-medium text-[#2B2B2B]"
        >
          View Subscription
        </button>
      </div>
    </SubscriptionScreenShell>
  );
}
