"use client";

import toast from "react-hot-toast";
import { Info } from "lucide-react";

// Plan-limit-reached notices are informational upsell nudges, not errors —
// shown with an info icon instead of toast.error's red X. Shared by every
// screen that can hit a plan limit (report cap, search cap, saved-lookups
// cap, community posting gate) so the treatment stays consistent.
export function showPlanLimitToast(message: string) {
  toast(message, {
    icon: <Info className="h-7 w-7 shrink-0" strokeWidth={2} color="#14C3CF" />,
  });
}
