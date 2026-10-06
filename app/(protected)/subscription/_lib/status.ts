import type { PlanCode } from "@/models/Subscription";

export type SubscriptionStatus = {
  plan: PlanCode;
  status: "NONE" | "ACTIVE" | "CANCELLED" | "PAST_DUE";
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus | null> {
  const res = await fetch("/api/subscriptions/status");
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) return null;
  return {
    plan: data.plan,
    status: data.status,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
  };
}

// "16 May 2026" — matches the style the old hardcoded placeholder used.
export function formatPlanDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}
