import { AchievementDoc, LevelConfig } from "@/models/User";

// XP is the only currency that drives level progression. Achievements are
// a separate, badge-only system (see ACHIEVEMENTS_CONFIG below) and no
// longer grant XP or points of any kind.
export const XP_CONFIG = {
  // XP awarded to the reporter when a submitted report is approved
  // (status -> "VERIFIED") by the reported user. False/rejected reports
  // award no XP.
  REPORT_APPROVED: 50,
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
