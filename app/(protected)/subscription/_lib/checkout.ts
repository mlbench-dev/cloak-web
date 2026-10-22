// Shared client-side helpers for the checkout/cancel flows, used by both
// the plan-picker page (UpgradeModal onConfirm) and the per-plan detail
// pages (CancelSubscriptionBlock onCancel).

import { CHECKOUT_HISTORY_KEY } from "./useCheckoutBackGuard";

export type PlanSlug = "cloak-pro";

// PayFast's checkout is a redirect + form POST, not a fetch — build a
// hidden form from the fields the server returned and submit it, which
// navigates the browser to PayFast's hosted checkout page.
function submitToPayfast(processUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = processUrl;

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

export async function startCheckout(plan: PlanSlug): Promise<void> {
  const res = await fetch("/api/subscriptions/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    throw new Error(data?.error || "Failed to start checkout. Please try again.");
  }

  // Lets useCheckoutBackGuard skip the PayFast history entries on return.
  try {
    window.sessionStorage.setItem(
      CHECKOUT_HISTORY_KEY,
      String(window.history.length),
    );
  } catch {
    // Storage blocked — the guard falls back to replacing with /profile.
  }

  submitToPayfast(data.processUrl, data.fields);
}

export async function cancelActiveSubscription(): Promise<void> {
  const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    throw new Error(data?.error || "Failed to cancel subscription. Please try again.");
  }
}
