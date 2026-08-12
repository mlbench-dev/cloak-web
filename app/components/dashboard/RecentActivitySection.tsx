import Image from "next/image";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";

type ActivityItem = {
  platform: "instagram" | "x" | "facebook" | "tiktok";
  url: string;
  username: string;
  status: string;
  timeAgo: string;
  profileImage?: string;
  reportId?: string;
};

type RecentActivitySectionProps = {
  items: ActivityItem[];
};

function getPlatformImage(platform: string) {
  switch (platform) {
    case "instagram":
      return "/images/social-media/insta.svg";
    case "twitter":
    case "x":
      return "/images/social-media/twitter.svg";
    case "facebook":
      return "/images/social-media/facebook.svg";
    case "tiktok":
      return "/images/social-media/tiktok.svg";
    default:
      return "/images/social-media/globe.svg";
  }
}

function PlatformBadge({ platform }: Pick<ActivityItem, "platform">) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
      <Image
        src={getPlatformImage(platform)}
        alt={platform}
        width={28}
        height={28}
        className="object-contain"
      />
    </div>
  );
}

function ActivityAvatar({
  username,
  profileImage,
}: Pick<ActivityItem, "username" | "profileImage">) {
  if (profileImage) {
    return (
      <div
        className="h-5 w-5 rounded-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${profileImage})` }}
        aria-label={`${username} profile image`}
        role="img"
      />
    );
  }

  return (
    <div
      className="flex h-5 w-5 items-center justify-center rounded-full  text-slate-500"
      aria-label="Default profile avatar"
      role="img"
    >
      <img src="/images/placeholder_avatar.png" className="h-4 w-4" />
      {/* <User className="h-3.5 w-3.5" strokeWidth={2} /> */}
    </div>
  );
}

function normalizeStatusLabel(status: string) {
  const normalized = status.trim().toUpperCase();

  if (normalized === "APPROVED") {
    return "Verified";
  }
  if (normalized === "AI VERIFIED") {
    return "AI Verified";
  }
  if (normalized === "PENDING") {
    return "Pending";
  }

  if (normalized === "FALSE_POSITIVE" || normalized === "REJECTED") {
    return "Rejected";
  }

  return status;
}

function getStatusColorClass(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized === "verified") return "text-[#14C3CF]";
  if (normalized === "pending") return "text-[#F59E0B]";
  if (normalized === "rejected") return "text-red-500";
  if (normalized === "ai_verified") return "text-[#14C3CF]";

  return "text-slate-400";
}

export default function RecentActivitySection({
  items,
}: RecentActivitySectionProps) {
  const router = useRouter();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-slate-900">
          Recent Activity
        </h2>
        <button
          type="button"
          onClick={() => router.push("/reports")}
          className="text-sm font-medium text-primary"
        >
          View All
        </button>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <article
            key={item.reportId || `${item.platform}-${item.url}`}
            onClick={() =>
              item.reportId && router.push(`/reports/${item.reportId}`)
            }
            className="flex items-center gap-3 rounded-2xl bg-[#F6F6F6] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)] cursor-pointer"
          >
            <PlatformBadge platform={item.platform} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {item.url}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <ActivityAvatar
                  username={item.username}
                  profileImage={item.profileImage}
                />
                <span className="text-xs text-slate-400">{item.username}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div
                className={`flex items-center justify-end gap-1 text-xs font-medium ${getStatusColorClass(
                  normalizeStatusLabel(item.status),
                )}`}
              >
                <span>{normalizeStatusLabel(item.status)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{item.timeAgo}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
