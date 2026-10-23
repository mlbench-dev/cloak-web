"use client";

import { useEffect, useRef } from "react";
import { SubscriptionScreenShell } from "../_components/SubscriptionUI";
import { rewindToSubscription } from "../_lib/checkoutReturn";

// PayFast's return URL after a successful payment. Nothing is shown here:
// this page sits right on top of PayFast in the tab's history, so browser
// back from it would land on PayFast. Instead it jumps back to the
// /subscription entry checkout started from, which shows "Payment
// received" (see _lib/checkoutReturn.ts).
export default function SubscriptionSuccessPage() {
  // Ref so Strict Mode's effect re-run doesn't rewind twice.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!rewindToSubscription("success")) {
      // Nothing to rewind to (e.g. storage blocked): show it there anyway.
      window.location.replace("/subscription?checkout=success");
    }
  }, []);

  return (
    <SubscriptionScreenShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
        <p className="text-[14px] text-[#8F98A0]">Confirming your payment...</p>
      </div>
    </SubscriptionScreenShell>
  );
}
