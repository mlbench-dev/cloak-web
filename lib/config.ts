import { AchievementDoc, LevelConfig } from "@/models/User";
import { PlanCode } from "@/models/Subscription";

// XP is the only currency that drives level progression. Achievements are
// a separate, badge-only system (see ACHIEVEMENTS_CONFIG below) and no
// longer grant XP or points of any kind.
export const XP_CONFIG = {
  // XP awarded to the reporter when a submitted report is approved
  // (status -> "VERIFIED") by the reported user. False/rejected reports
  // award no XP.
  REPORT_APPROVED: 50,
};

// Shared between the support form's client-side char counters and the
// server-side validation in POST /api/support — kept here (not in the API
// route file) since route.ts exports pull in server-only deps (nodemailer,
// mongodb) that can't be part of a client bundle.
export const MAX_SUPPORT_MESSAGE_LENGTH = 2000;
export const MAX_SUPPORT_SUBJECT_LENGTH = 120;

// Display name shown wherever a plan is referenced in user-facing copy
// (upsell toasts, checkout item_name, etc.) — single source so it can't
// drift between call sites.
export const PLAN_DISPLAY_NAME: Record<PlanCode, string> = {
  FREEMIUM: "Freemium",
  BOOST: "Boost Protection",
  CLOAK_PRO: "Cloak Pro",
};

// Per-plan limits and perks, enforced by lib/planLimits.ts. null means
// unlimited. Prices are in ZAR cents (PayFast settles in ZAR only) — the
// USD figures shown in the UI ($4.99 / $11.99) are a fixed display peg, not
// live FX conversion, and are decoupled from this billed amount.
//
// priceZarCents below were computed 2026-08-11 off a live USD/ZAR quote
// (~16.17) with a small buffer for daily FX drift + PayFast transaction
// fees, rounded to a clean price point — NOT a confirmed final business
// price. Confirm with the client before going live; ZAR/USD moves daily
// and PayFast doesn't do dynamic conversion, so this needs a human
// decision on cadence for revisiting it, not just a one-time set.
export const PLAN_LIMITS: Record<
  PlanCode,
  {
    reportsPerMonth: number | null;
    searchesPerDay: number | null;
    savedLookupsMax: number | null;
    canPostCommunity: boolean;
    // Direct-to-inbox contact form (see app/(protected)/support) — a Cloak
    // Pro-exclusive perk, unlike canPostCommunity above which Boost also gets.
    canContactSupport: boolean;
    xpMultiplier: number;
    priceZarCents: number;
    // How long a failed AI-confidence check waits before automatically
    // retrying (lib/reportAiConfidence.ts). Reports still process in the
    // order submitted — this isn't a priority queue — but a shorter
    // cooldown means a paying user's retry-after-failure comes back
    // faster on average. Applies per report, keyed off the reporter's plan.
    retryCooldownMs: number;
  }
> = {
  FREEMIUM: {
    reportsPerMonth: 3,
    searchesPerDay: 10,
    savedLookupsMax: 5,
    canPostCommunity: false,
    canContactSupport: false,
    xpMultiplier: 1,
    priceZarCents: 0,
    retryCooldownMs: 60 * 1000,
  },
  BOOST: {
    reportsPerMonth: 20,
    searchesPerDay: null,
    savedLookupsMax: null,
    canPostCommunity: true,
    canContactSupport: false,
    xpMultiplier: 1.5,
    // $4.99 @ ~16.17 ZAR/USD ≈ R80.71 + buffer -> R84.99. Provisional.
    priceZarCents: 8499,
    retryCooldownMs: 20 * 1000,
  },
  CLOAK_PRO: {
    reportsPerMonth: null,
    searchesPerDay: null,
    savedLookupsMax: null,
    canPostCommunity: true,
    canContactSupport: true,
    xpMultiplier: 2,
    // $11.99 @ ~16.17 ZAR/USD ≈ R193.93 + buffer -> R199.99. Provisional.
    priceZarCents: 19999,
    retryCooldownMs: 10 * 1000,
  },
};

// Level thresholds: total XP required to reach each level. Below the first
// threshold a user is unranked (level 0). Configurable here only — nothing
// else in the codebase should hardcode these values.
export const LEVEL_CONFIG: LevelConfig[] = [
  { level: 1, xpRequired: 50 },
  { level: 2, xpRequired: 150 },
  { level: 3, xpRequired: 400 },
  { level: 4, xpRequired: 900 },
  { level: 5, xpRequired: 1500 },
  { level: 6, xpRequired: 2500 },
  { level: 7, xpRequired: 4000 },
  { level: 8, xpRequired: 6000 },
];

// Achievements are badge-only milestones — reaching the target unlocks the
// badge and nothing else. They have no effect on XP or level.
export const ACHIEVEMENTS_CONFIG: AchievementDoc[] = [
  {
    code: "FIRST_SIGNAL",
    name: "First Signal",
    description: "Submit Your First Report",
    target: 1,
    iconColor: "#F59E0B",
    order: 1,
  },
  {
    code: "ACTIVE_WATCHER",
    name: "Active Watcher",
    description: "Submit 10 Reports",
    target: 10,
    iconColor: "#8B5CF6",
    order: 2,
  },
  {
    code: "SCOUT",
    name: "Scout",
    description: "Submit 50 Reports",
    target: 50,
    iconColor: "#6366F1",
    order: 3,
  },
  {
    code: "SENTINEL",
    name: "Sentinel",
    description: "Submit 100 Reports",
    target: 100,
    iconColor: "#3B82F6",
    order: 4,
  },
  {
    code: "SHARP_EYE",
    name: "Sharp Eye",
    description: "Get 5 Reports Verified",
    target: 5,
    iconColor: "#10B981",
    order: 5,
  },
  {
    code: "TRUTH_SEEKER",
    name: "Truth Seeker",
    description: "Get 25 Reports Verified",
    target: 25,
    iconColor: "#06B6D4",
    order: 6,
  },
  {
    code: "ELITE_DETECTOR",
    name: "Elite Detector",
    description: "Get 75 Reports Verified",
    target: 75,
    iconColor: "#EC4899",
    order: 7,
  },
  {
    code: "CLOAK_GUARDIAN",
    name: "Cloak Guardian",
    description: "Maintain 100% Accuracy With 50 Verified Reports",
    target: 50,
    iconColor: "#EF4444",
    order: 8,
  },
];
