import Image from "next/image";
import { useRouter } from "next/navigation";

type Achievement = {
  name: string;
  progress: number;
  color: string;
  imageSrc: string;
};

type AchievementsSectionProps = {
  achievements: readonly Achievement[];
};

function AchievementRing({
  name,
  progress,
  color,
  imageSrc,
}: Achievement) {
  const normalizedProgress = Math.max(0, Math.min(progress, 100));

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${color} 0deg ${normalizedProgress * 3.6}deg, #E5E7EB ${normalizedProgress * 3.6}deg 360deg)`,
        }}
      >
        <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#F8F8F8]">
          <Image
            src={imageSrc}
            alt={name}
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
            unoptimized={true}
          />
        </div>
      </div>
      <span className="text-[11px] leading-4 text-slate-700">{name}</span>
    </div>
  );
}

export default function AchievementsSection({ achievements }: AchievementsSectionProps) {
  const router = useRouter();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-slate-900">Achievements</h2>
        <button
          type="button"
          onClick={() => router.push("/progress")}
          className="text-sm font-medium text-primary"
        >
          View All
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {achievements.map((achievement) => (
          <AchievementRing key={achievement.name} {...achievement} />
        ))}
      </div>
    </section>
  );
}
