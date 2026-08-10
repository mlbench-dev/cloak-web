import VerifiedBadge from "@/app/components/VerifiedBadge";
import { Crown, User } from "lucide-react";
import Image from "next/image";
import { LEVEL_CONFIG } from "@/lib/config";
type Stat = {
  label: string;
  value: string;
};

type LastAchievement = {
  name: string;
  imageSrc: string;
};

type DashboardHeaderProps = {
  username: string;
  levelLabel: string;
  lastAchievement?: LastAchievement | null;
  verified: boolean;
  premium: boolean;
  stats: Stat[];
  xpToNextLevel: number;
  currentXp: number;
  nextLevelXp: number;
  levelProgress: number;
  profileImage?: string;
  image?: string;
  currentLevel: number;
};

export default function DashboardHeader({
  username,
  levelLabel,
  lastAchievement,
  verified,
  premium,
  stats,
  xpToNextLevel,
  currentXp,
  nextLevelXp,
  levelProgress,
  profileImage,
  image,
  currentLevel,
}: DashboardHeaderProps) {
  const avatarUrl = profileImage || image;
  const currentLevelConfig = LEVEL_CONFIG.find(
    (level) => level.level === currentLevel,
  );
  const currentLevelXp = Math.max(
    0,
    currentXp - (currentLevelConfig?.xpRequired || 0),
  );
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg leading-none text-slate-900">{username}</h1>
            {verified && (
              <VerifiedBadge
                className="h-4 w-4 text-primary"
                strokeWidth={1.9}
              />
            )}
            {premium && (
              <Crown
                className="h-4 w-4 fill-primary text-primary"
                strokeWidth={1.8}
              />
            )}
          </div>
          <p className="text-[13px] text-slate-400">
            {levelLabel}
            {lastAchievement ? ` · ${lastAchievement.name}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <div
            className="h-14 w-14 shrink-0 rounded-full bg-cover bg-center bg-no-repeat shadow-sm"
            style={{ backgroundImage: `url(${avatarUrl})` }}
            aria-label={`${username} profile image`}
            role="img"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-sm"
            aria-label="Default profile avatar"
            role="img"
          >
            <User className="h-7 w-7" strokeWidth={1.8} />
          </div>
        )}

        <div className="grid flex-1 grid-cols-3 gap-3 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-lg font-medium leading-none text-slate-900 text-left">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-slate-400 text-left">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-2xl bg-[#E7FAFC] px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            {xpToNextLevel} points away from Level {currentLevel + 1}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex w-full items-center">
            <div className="h-1.5 overflow-hidden rounded-full bg-primary/20 w-full">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <Image
              src="/images/dashboard/shield.svg"
              alt="Shield"
              width={24}
              height={24}
              className="h-4 w-4 fill-primary text-primary"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{currentXp}</span>
            <span>
              {currentXp}/{nextLevelXp}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
