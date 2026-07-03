import {
  ACHIEVEMENTS,
  LEVEL_CONFIG,
} from "./config";
import { UserDoc } from "@/models/User";

// Calculate current level and progress from points
export function calculateLevel(points: number) {
  let currentLevel = 1;
  let nextLevelPoints = LEVEL_CONFIG[1]?.pointsRequired || 100;

  for (let i = 0; i < LEVEL_CONFIG.length; i++) {
    if (points >= LEVEL_CONFIG[i].pointsRequired) {
      currentLevel = LEVEL_CONFIG[i].level;
      nextLevelPoints = LEVEL_CONFIG[i + 1]?.pointsRequired || Infinity;
    } else {
      break;
    }
  }

  const currentLevelConfig = LEVEL_CONFIG.find(l => l.level === currentLevel);
  const nextLevelConfig = LEVEL_CONFIG.find(l => l.level === currentLevel + 1);
  const pointsToNextLevel = nextLevelConfig ? nextLevelConfig.pointsRequired - points : 0;
  let progressPercentage = 0;

  if (currentLevelConfig && nextLevelConfig) {
    const levelPoints = points - currentLevelConfig.pointsRequired;
    const levelTotalPoints = nextLevelConfig.pointsRequired - currentLevelConfig.pointsRequired;
    progressPercentage = Math.min(100, Math.max(0, (levelPoints / levelTotalPoints) * 100));
  }

  return {
    currentLevel,
    nextLevelPoints,
    pointsToNextLevel,
    progressPercentage,
  };
}

// Initialize default user achievements array
export function initializeUserAchievements() {
  return ACHIEVEMENTS.map(achievement => ({
    code: achievement.code,
    progress: 0,
    target: achievement.target,
    unlockedAt: null,
  }));
}

// Check and unlock achievements as needed
export async function checkAchievements(user: UserDoc) {
  const updatedAchievements = [...user.achievements];
  let pointsToAdd = 0;
  let levelChanged = false;

  // Check each achievement
  ACHIEVEMENTS.forEach(achievementConfig => {
    const existingAchievement = updatedAchievements.find(a => a.code === achievementConfig.code);
    let newProgress = existingAchievement?.progress || 0;

    switch (achievementConfig.code) {
      case "FIRST_SIGNAL":
        // Cap at 1
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

    // Check if should unlock and not already unlocked
    const achievement = updatedAchievements.find(a => a.code === achievementConfig.code)!;
    if (!achievement.unlockedAt && achievement.progress >= achievement.target) {
      achievement.unlockedAt = new Date();
      pointsToAdd += achievementConfig.pointsReward;
      levelChanged = true;
    }
  });

  return { updatedAchievements, pointsToAdd, levelChanged };
}
