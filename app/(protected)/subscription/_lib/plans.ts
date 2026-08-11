import {
  LucideMegaphoneOff,
  FlagTriangleRight,
  Bookmark,
  Crown,
  Search,
  ShieldPlus,
  Users,
  Zap,
  LifeBuoy,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/config";

export type PlanTone = "slate" | "teal" | "green";

export type PlanFeature = {
  icon: LucideIcon;
  label: string;
};

export type PlanSummary = {
  slug: "cloak-pro" | "boost-protection";
  name: string;
  price: string;
  priceLine: string;
  // What PayFast will actually show and charge — derived from the same
  // PLAN_LIMITS.priceZarCents the checkout route bills against, so this
  // can't drift out of sync with the real charge. Displayed so the ZAR
  // amount on PayFast's checkout page isn't a surprise after the USD
  // price shown here.
  zarPriceLine: string;
  description: string;
  icon: LucideIcon;
  tone: Exclude<PlanTone, "slate">;
  features: PlanFeature[];
};

function formatZarPriceLine(priceZarCents: number): string {
  return `≈ R${(priceZarCents / 100).toFixed(2)} ZAR, billed via PayFast`;
}

// Feature copy here reflects the finalized, technically-scoped plan shared
// with the client — every line here has real enforcement behind it in
// lib/config.ts's PLAN_LIMITS. Don't add a line here without matching
// backend enforcement, or it becomes the same kind of unbacked marketing
// claim this replaced.
export const freemiumFeatures: PlanFeature[] = [
  { icon: FlagTriangleRight, label: "3 reports per month" },
  { icon: LucideMegaphoneOff, label: "Basic alerts" },
  { icon: Search, label: "10 searches per day" },
  { icon: Bookmark, label: "5 saved lookups" },
  { icon: Users, label: "View-only community feed" },
];

export const boostProtectionFeatures: PlanFeature[] = [
  { icon: FlagTriangleRight, label: "20 reports per month" },
  { icon: Search, label: "Unlimited search" },
  { icon: Bookmark, label: "Unlimited saved lookups" },
  { icon: Users, label: "Post in the community feed" },
  { icon: Zap, label: "1.5x points on approved reports" },
  { icon: Timer, label: "Faster verification retries" },
];

export const cloakProFeatures: PlanFeature[] = [
  { icon: FlagTriangleRight, label: "Unlimited reports" },
  { icon: Search, label: "Unlimited search & saved lookups" },
  { icon: Users, label: "Post in the community feed" },
  { icon: Zap, label: "2x points on approved reports" },
  { icon: LifeBuoy, label: "Priority support" },
];

export const cloakProPlan: PlanSummary = {
  slug: "cloak-pro",
  name: "Cloak Pro",
  price: "$11.99",
  priceLine: "$11.99 per month",
  zarPriceLine: formatZarPriceLine(PLAN_LIMITS.CLOAK_PRO.priceZarCents),
  description: "Unlimited reports, 2x points, and priority support",
  icon: Crown,
  tone: "teal",
  features: cloakProFeatures,
};

export const boostProtectionPlan: PlanSummary = {
  slug: "boost-protection",
  name: "Boost Protection",
  price: "$4.99",
  priceLine: "$4.99 per month",
  zarPriceLine: formatZarPriceLine(PLAN_LIMITS.BOOST.priceZarCents),
  description: "More reports, unlimited search, and community posting",
  icon: ShieldPlus,
  tone: "green",
  features: boostProtectionFeatures,
};
