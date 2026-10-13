import {
  Crown,
  FlagTriangleRight,
  ImagePlus,
  LayoutGrid,
  Megaphone,
  MegaphoneOff,
  Radar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/config";

export type PlanTone = "slate" | "teal";

export type PlanFeature = {
  icon: LucideIcon;
  label: string;
};

export type PlanSummary = {
  slug: "cloak-pro";
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

// Copy follows the approved subscription design.
export const freemiumFeatures: PlanFeature[] = [
  { icon: ImagePlus, label: "3 image uploads" },
  { icon: MegaphoneOff, label: "Basic Alerts" },
  { icon: FlagTriangleRight, label: "Manual Reporting" },
  { icon: Radar, label: "One time AI Monitoring" },
];

export const cloakProFeatures: PlanFeature[] = [
  { icon: ImagePlus, label: "Unlimited Uploads" },
  { icon: Megaphone, label: "Real Time Alerts" },
  { icon: Radar, label: "Daily AI Monitoring" },
  { icon: LayoutGrid, label: "Advanced Dashboard" },
];

export const cloakProPlan: PlanSummary = {
  slug: "cloak-pro",
  name: "Cloak Pro",
  price: "$11.99",
  priceLine: "$11.99 per month",
  zarPriceLine: formatZarPriceLine(PLAN_LIMITS.CLOAK_PRO.priceZarCents),
  description: "Unlock everything at the go",
  icon: Crown,
  tone: "teal",
  features: cloakProFeatures,
};
