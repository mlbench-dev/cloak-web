"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import Image from "next/image";
import { LEVEL_CONFIG } from "@/lib/config";

interface DashboardUser {
  username: string;
  name: string;
  image?: string;
  profileImage?: string;
  isVerified: boolean;
  identityVerificationStatus?: string;
  role: string;
}

interface DashboardStats {
  level: number;
  levelName: string;
  levelProgress: number;
  pointsToNextLevel: number;
  totalReports: number;
  verifiedReports: number;
  accuracyPercentage: number;
  totalPoints: number;
}

interface DashboardAchievement {
  code: string;
  config: {
    name: string;
    description: string;
    iconColor: string;
    order: number;
    pointsReward: number;
    target: number;
  };
  progress: number;
  target: number;
  unlockedAt?: Date;
}

const getAchievementIcon = (code: string) => {
  switch (code) {
    case "FIRST_SIGNAL":
      return "/images/dashboard/achievements/first-signal.svg";
    case "ACTIVE_WATCHER":
      return "/images/dashboard/achievements/active-watcher.svg";
    case "SCOUT":
      return "/images/dashboard/achievements/scout.svg";
    case "SENTINEL":
      return "/images/dashboard/achievements/sentinal.svg";
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
};

export default function ProgressPage() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [achievements, setAchievements] = useState<DashboardAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedDashboard = useRef(false);

  useEffect(() => {
    if (hasFetchedDashboard.current) return;
    hasFetchedDashboard.current = true;

    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/user/dashboard");
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          setStats(data.stats);
          setAchievements(data.achievements);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const levelMeta = useMemo(() => {
    const currentLevel = stats?.level || 1;
    const currentLevelConfig =
      LEVEL_CONFIG.find((level) => level.level === currentLevel) ||
      LEVEL_CONFIG[0];
    const nextLevelConfig = LEVEL_CONFIG.find(
      (level) => level.level === currentLevel + 1,
    );
    const totalPoints = stats?.totalPoints || 0;
    const currentLevelPoints = Math.max(
      0,
      totalPoints - (currentLevelConfig?.pointsRequired || 0),
    );
    const nextLevelPoints =
      nextLevelConfig?.pointsRequired ||
      totalPoints + (stats?.pointsToNextLevel || 0);

    return {
      currentLevelPoints,
      nextLevelPoints,
    };
  }, [stats]);

  const levelRingOffset = useMemo(() => {
    const normalizedProgress = Math.max(
      0,
      Math.min(stats?.levelProgress || 0, 100),
    );
    const circumference = 314;
    return circumference - (normalizedProgress / 100) * circumference;
  }, [stats?.levelProgress]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="h-10 w-10 rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="shrink-0 flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)] bg-white">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full active:scale-95"
        >
          <ChevronLeft className="h-6 w-6 text-[#6B7280]" />
        </button>
        <h2 className="text-[15px] font-semibold text-[#2D2D2D]">
          Your Progress
        </h2>
        <div className="w-10" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-3">
        <div className="mx-auto max-w-[420px]">
          <div className="flex flex-col items-center pt-2">
            <div className="relative h-[112px] w-[112px]">
              <svg
                viewBox="0 0 120 120"
                className="absolute inset-0 h-full w-full"
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#E5E5E5"
                  strokeWidth="6"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#14C3CF"
                  strokeWidth="6"
                  strokeDasharray="314"
                  strokeDashoffset={levelRingOffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-[15px] flex items-center justify-center rounded-full bg-[#F7F7F7]">
                <Trophy
                  className="h-11 w-11 text-[#14C3CF]"
                  strokeWidth={1.8}
                />
              </div>
            </div>

            <h3 className="mt-4 text-[17px] font-medium leading-none text-[#2D2D2D]">
              {user?.username || user?.name || "Cloak User"}
            </h3>
            <p className="mt-2 text-[13px] text-[#A7ADB2]">
              Level {stats?.level || 1}/10
            </p>
          </div>

          <div className="mt-8">
            <p className="text-[14px] font-medium text-[#3F3F46]">
              {stats?.pointsToNextLevel || 0} points away from Level{" "}
              {(stats?.level || 1) + 1}
            </p>
            <div className="mt-3 h-[10px] w-full overflow-hidden rounded-full bg-[#E8E8E8]">
              <div
                className="h-full rounded-full bg-[#14C3CF] transition-all duration-500"
                style={{
                  width: `${Math.max(0, Math.min(stats?.levelProgress || 0, 100))}%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[13px] text-[#A7ADB2]">
              <span>{levelMeta.currentLevelPoints}</span>
              <span>
                {stats?.totalPoints || 0}/{levelMeta.nextLevelPoints}
              </span>
            </div>
          </div>

          <div className="mt-7">
            <h2 className="text-[17px] font-semibold text-[#2D2D2D]">
              Achievements
            </h2>

            <div className="mt-4 space-y-5">
              {achievements.map((achievement) => {
                const isUnlocked = !!achievement.unlockedAt;
                const progressPercent = Math.min(
                  100,
                  (achievement.progress / achievement.target) * 100,
                );

                return (
                  <div
                    key={achievement.code}
                    className="flex items-start gap-3"
                  >
                    <div
                      className="mt-0.5 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(${achievement.config.iconColor} 0deg ${progressPercent * 3.6}deg, #E5E7EB ${progressPercent * 3.6}deg 360deg)`,
                      }}
                    >
                      <div className="flex h-[45px] w-[45px] items-center justify-center rounded-full bg-[#F8F8F8]">
                        <Image
                          src={getAchievementIcon(achievement.code)}
                          alt={achievement.config.name}
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px] object-contain opacity-70"
                          unoptimized
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-[15px] font-medium leading-5 text-[#2D2D2D]">
                        {achievement.config.name}
                      </h4>
                      <p className="mt-1 text-[13px] leading-5 text-[#A7ADB2]">
                        {achievement.config.description}
                      </p>
                    </div>

                    <span
                      className={`pt-0.5 text-[15px] font-medium ${
                        isUnlocked ? "text-[#2D2D2D]" : "text-[#6B7280]"
                      }`}
                    >
                      {achievement.progress}/{achievement.target}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
