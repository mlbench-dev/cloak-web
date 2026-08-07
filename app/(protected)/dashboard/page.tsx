"use client";

import { useEffect, useRef, useState } from "react";
import AchievementsSection from "@/app/components/dashboard/AchievementsSection";
import DashboardHeader from "@/app/components/dashboard/DashboardHeader";
import RecentActivitySection from "@/app/components/dashboard/RecentActivitySection";
import { getAchievementIcon } from "@/lib/achievements";

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
  xp: number;
  level: number;
  levelProgress: number;
  xpToNextLevel: number;
  totalReports: number;
  verifiedReports: number;
  accuracyPercentage: number;
}

interface DashboardAchievement {
  code: string;
  config: {
    name: string;
    description: string;
    iconColor: string;
    order: number;
    target: number;
  };
  progress: number;
  target: number;
  unlockedAt?: Date;
}

interface DashboardRecentActivity {
  _id: string;
  platform: string;
  sourceLink: string;
  reportedByUser: {
    username: string;
    name?: string;
    image?: string;
    profileImage?: string;
    identityVerificationStatus?: string;
  };
  status: string;
  createdAt: Date;
}

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [achievements, setAchievements] = useState<DashboardAchievement[]>([]);
  const [recentActivity, setRecentActivity] = useState<
    DashboardRecentActivity[]
  >([]);
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
          setRecentActivity(data.recentActivity);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin"></div>
      </div>
    );
  }

  const componentAchievements = achievements.slice(0, 5).map((a) => ({
    name: a.config.name,
    progress: Math.min(100, (a.progress / a.target) * 100),
    color: a.config.iconColor,
    imageSrc: getAchievementIcon(a.code),
  }));

  const lastCompletedAchievement = achievements
    .filter((a) => a.unlockedAt)
    .sort(
      (a, b) =>
        new Date(b.unlockedAt as Date).getTime() -
        new Date(a.unlockedAt as Date).getTime(),
    )[0];

  const lastAchievement = lastCompletedAchievement
    ? {
        name: lastCompletedAchievement.config.name,
        imageSrc: getAchievementIcon(lastCompletedAchievement.code),
      }
    : null;

  const componentRecentActivity = recentActivity.map((a) => {
    const date = new Date(a.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let timeAgo = "Just now";
    if (diffDays > 0) {
      timeAgo = `${diffDays}d ago`;
    } else {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours > 0) {
        timeAgo = `${diffHours}h ago`;
      } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffMinutes > 0) {
          timeAgo = `${diffMinutes}m ago`;
        }
      }
    }

    return {
      platform: (a.platform === "twitter" ? "x" : a.platform) as any,
      url: a.sourceLink,
      username: a.reportedByUser.username,
      status:
        a.status === "VERIFIED" || a.status === "APPROVED"
          ? "Approved"
          : a.status === "PENDING"
            ? "Pending"
            : a.status === "FALSE_POSITIVE" || a.status === "REJECTED"
              ? "Rejected"
              : a.status,
      timeAgo,
      profileImage: a.reportedByUser.profileImage || a.reportedByUser.image,
      reportId: a._id,
    };
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        username={user?.username || "user"}
        levelLabel={stats && stats.level > 0 ? `Level ${stats.level}` : "Unranked"}
        lastAchievement={lastAchievement}
        verified={user?.identityVerificationStatus === "APPROVED"}
        premium={user?.role === "VERIFIED_USER"}
        stats={[
          { label: "Reports", value: `${stats?.totalReports || 0}` },
          { label: "Verified", value: `${stats?.verifiedReports || 0}` },
          { label: "Accuracy", value: `${stats?.accuracyPercentage || 0}%` },
        ]}
        xpToNextLevel={stats?.xpToNextLevel || 0}
        currentXp={stats?.xp || 0}
        nextLevelXp={(stats?.xp || 0) + (stats?.xpToNextLevel || 0)}
        levelProgress={stats?.levelProgress || 0}
        profileImage={user?.profileImage}
        image={user?.image}
        currentLevel={stats?.level || 0}
      />

      <AchievementsSection achievements={componentAchievements} />
      <RecentActivitySection items={componentRecentActivity} />
    </div>
  );
}
