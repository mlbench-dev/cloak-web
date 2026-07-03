import { AchievementCode, AchievementDoc, LevelConfig } from "@/models/User";

// Points configuration
export const POINTS_CONFIG = {
  // Points for submitting a report
  REPORT_SUBMISSION: 0, 
  // Points for having a report verified
  REPORT_VERIFICATION: 100,
  // Base points multiplier for level thresholds (50, 50*10=500, 50*50=2500, etc.)
  LEVEL_MULTIPLIERS: [1, 10, 50, 100, 200, 400, 800],
};

export const LEVEL_CONFIG: LevelConfig[] = [
  { level: 1, pointsRequired: 0, name: "First Signal" },
  { level: 2, pointsRequired: POINTS_CONFIG.LEVEL_MULTIPLIERS[0] * 50, name: "Active Watcher" },
  { level: 3, pointsRequired: POINTS_CONFIG.LEVEL_MULTIPLIERS[1] * 50, name: "Scout" },
  { level: 4, pointsRequired: POINTS_CONFIG.LEVEL_MULTIPLIERS[2] * 50, name: "Sentinel" },
  { level: 5, pointsRequired: POINTS_CONFIG.LEVEL_MULTIPLIERS[3] * 50, name: "Sharp Eye" },
  { level: 6, pointsRequired: POINTS_CONFIG.LEVEL_MULTIPLIERS[4] * 50, name: "Truth Seeker" },
  { level: 7, pointsRequired: POINTS_CONFIG.LEVEL_MULTIPLIERS[5] * 50, name: "Elite Detector" },
  { level: 8, pointsRequired: POINTS_CONFIG.LEVEL_MULTIPLIERS[6] * 50, name: "Cloak Guardian" },
];

export const ACHIEVEMENTS: AchievementDoc[] = [
  {
    code: "FIRST_SIGNAL",
    name: "First Signal",
    description: "Submit Your First Report",
    pointsReward: 50,
    target: 1,
    iconColor: "#F59E0B",
    order: 1,
  },
  {
    code: "ACTIVE_WATCHER",
    name: "Active Watcher",
    description: "Submit 10 Reports",
    pointsReward: 100,
    target: 10,
    iconColor: "#8B5CF6",
    order: 2,
  },
  {
    code: "SCOUT",
    name: "Scout",
    description: "Submit 50 Reports",
    pointsReward: 250,
    target: 50,
    iconColor: "#6366F1",
    order: 3,
  },
  {
    code: "SENTINEL",
    name: "Sentinel",
    description: "Submit 100 Reports",
    pointsReward: 500,
    target: 100,
    iconColor: "#3B82F6",
    order: 4,
  },
  {
    code: "SHARP_EYE",
    name: "Sharp Eye",
    description: "Get 5 Reports Verified",
    pointsReward: 150,
    target: 5,
    iconColor: "#10B981",
    order: 5,
  },
  {
    code: "TRUTH_SEEKER",
    name: "Truth Seeker",
    description: "Get 25 Reports Verified",
    pointsReward: 300,
    target: 25,
    iconColor: "#06B6D4",
    order: 6,
  },
  {
    code: "ELITE_DETECTOR",
    name: "Elite Detector",
    description: "Get 75 Reports Verified",
    pointsReward: 750,
    target: 75,
    iconColor: "#EC4899",
    order: 7,
  },
  {
    code: "CLOAK_GUARDIAN",
    name: "Cloak Guardian",
    description: "Maintain 100% Accuracy With 50 Verified Reports",
    pointsReward: 1000,
    target: 50,
    iconColor: "#EF4444",
    order: 8,
  },
];
