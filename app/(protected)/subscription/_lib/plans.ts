import {
  LucideMegaphoneOff,
  LucideMegaphone,
  FlagTriangleRight,
  Bookmark,
  Crown,
  FileText,
  ImagePlus,
  Search,
  ShieldPlus,
  Radar,
  LayoutDashboard,
  ScanText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  description: string;
  icon: LucideIcon;
  tone: Exclude<PlanTone, "slate">;
  features: PlanFeature[];
};

export const freemiumFeatures: PlanFeature[] = [
  { icon: ImagePlus, label: "3 image uploads" },
  { icon: LucideMegaphoneOff, label: "Basic Alerts" },
  { icon: FlagTriangleRight, label: "Manual Reporting" },
];

export const cloakProFeatures: PlanFeature[] = [
  { icon: ImagePlus, label: "Unlimited Uploads" },
  { icon: LucideMegaphone, label: "Real Time Alerts" },
  { icon: Radar, label: "Priority Detection" },
  { icon: LayoutDashboard, label: "Advanced Dashboard" },
];

export const boostProtectionFeatures: PlanFeature[] = [
  { icon: ScanText, label: "More Scans" },
  { icon: LucideMegaphone, label: "Faster Alerts" },
  { icon: Radar, label: "Priority Detection" },
];

export const cloakProPlan: PlanSummary = {
  slug: "cloak-pro",
  name: "Cloak Pro",
  price: "$11.99",
  priceLine: "$11.99 per month",
  description: "Unlock everything at the go",
  icon: Crown,
  tone: "teal",
  features: cloakProFeatures,
};

export const boostProtectionPlan: PlanSummary = {
  slug: "boost-protection",
  name: "Boost Protection",
  price: "$4.99",
  priceLine: "$4.99 per month",
  description: "Get more scans, faster alerts, priority detection",
  icon: ShieldPlus,
  tone: "green",
  features: boostProtectionFeatures,
};

export const activePlanMeta = {
  nextChargeDate: "16 May 2026",
  accessUntilDate: "16 May",
};
