import { ACHIEVEMENTS_CONFIG, LEVEL_CONFIG } from "./config";
import { AchievementCode, UserDoc } from "@/models/User";

// Shared badge icon lookup — used by every screen that renders achievement
// badges (dashboard, progress, profile) so the mapping can't drift out of
// sync between them again.
export function getAchievementIcon(code: AchievementCode | string) {
  switch (code) {
    case "FIRST_SIGNAL":
      return "/images/dashboard/achievements/first-signal.svg";
    case "ACTIVE_WATCHER":
      return "/images/dashboard/achievements/active-watcher.svg";
    case "SCOUT":
      return "/images/dashboard/achievements/scout.svg";
    case "SENTINEL":
      return "/images/dashboard/achievements/sentinal.svg"; // File is named sentinal.svg
    case "SHARP_EYE":
      return "/images/dashboard/achievements/sharp-eye.svg";
    case "TRUTH_SEEKER":
      return "/images/dashboard/achievements/truth-seeker.svg";
    case "ELITE_DETECTOR":
      return "/images/dashboard/achievements/elite-detector.svg";
    case "CLOAK_GUARDIAN":
      return "/images/dashboard/achievements/cloak-guardian.svg";
    default:
      return "/images/dashboard/achievements/first-signal.svg";
  }
}

// Calculate current level and progress from XP. Levels start at 1 once the
// first threshold is reached; below that, a user is level 0 (unranked).
export function calculateLevel(xp: number) {
  let currentLevel = 0;
  let nextLevelXp = LEVEL_CONFIG[0]?.xpRequired ?? Infinity;

  for (let i = 0; i < LEVEL_CONFIG.length; i++) {
    if (xp >= LEVEL_CONFIG[i].xpRequired) {
      currentLevel = LEVEL_CONFIG[i].level;
      nextLevelXp = LEVEL_CONFIG[i + 1]?.xpRequired ?? Infinity;
    } else {
      nextLevelXp = LEVEL_CONFIG[i].xpRequired;
      break;
    }
  }

  const currentLevelConfig = LEVEL_CONFIG.find(l => l.level === currentLevel);
  const currentLevelXp = currentLevelConfig?.xpRequired ?? 0;
  const xpToNextLevel = nextLevelXp === Infinity ? 0 : nextLevelXp - xp;
  let progressPercentage = 0;

  if (nextLevelXp !== Infinity) {
    const levelXp = xp - currentLevelXp;
    const levelTotalXp = nextLevelXp - currentLevelXp;
    progressPercentage = Math.min(100, Math.max(0, (levelXp / levelTotalXp) * 100));
  } else {
    progressPercentage = 100;
  }

  return {
    currentLevel,
    nextLevelXp,
    xpToNextLevel,
    progressPercentage,
  };
}

// Initialize default user achievements array
export function initializeUserAchievements() {
  return ACHIEVEMENTS_CONFIG.map(achievement => ({
    code: achievement.code,
    progress: 0,
    target: achievement.target,
    unlockedAt: null,
  }));
}

// Recompute achievement progress and unlock badges as milestones are
// reached. Achievements are badge-only — this never touches XP or level.
export function checkAchievements(user: UserDoc) {
  const updatedAchievements = [...user.achievements];

  ACHIEVEMENTS_CONFIG.forEach(achievementConfig => {
    const existingAchievement = updatedAchievements.find(a => a.code === achievementConfig.code);
    let newProgress = existingAchievement?.progress || 0;

    switch (achievementConfig.code) {
      case "FIRST_SIGNAL":
        // Unlocks on submission, not approval.
        newProgress = Math.min(user.totalReports, 1);
        break;
      case "ACTIVE_WATCHER":
      case "SCOUT":
      case "SENTINEL":
        // Cap at their respective targets
        newProgress = Math.min(user.totalReports, achievementConfig.target);
        break;
      case "SHARP_EYE":
      case "TRUTH_SEEKER":
      case "ELITE_DETECTOR":
        // Cap at their respective targets
        newProgress = Math.min(user.verifiedReports, achievementConfig.target);
        break;
      case "CLOAK_GUARDIAN":
        newProgress = user.accuracyPercentage >= 100 && user.verifiedReports >= 50 ? 50 : Math.min(user.verifiedReports, 49);
        break;
    }

    if (!existingAchievement) {
      updatedAchievements.push({
        code: achievementConfig.code,
        progress: newProgress,
        target: achievementConfig.target,
        unlockedAt: null,
      });
    } else if (existingAchievement.progress !== newProgress) {
      existingAchievement.progress = newProgress;
    }

    // Unlock the badge once, and never re-evaluate it after that.
    const achievement = updatedAchievements.find(a => a.code === achievementConfig.code)!;
    if (!achievement.unlockedAt && achievement.progress >= achievement.target) {
      achievement.unlockedAt = new Date();
    }
  });

  return { updatedAchievements };
}
