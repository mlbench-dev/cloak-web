import Image from "next/image";
import type { IncidentStatus } from "../_lib/incidents";

// Any platform not explicitly listed (YouTube included) falls back to the
// generic globe icon, same as an unrecognized site would.
const PLATFORM_ICON_SRC: Record<string, string> = {
  instagram: "/images/social-media/insta.svg",
  tiktok: "/images/social-media/tiktok.svg",
  twitter: "/images/social-media/twitter.svg",
  facebook: "/images/social-media/facebook.svg",
  other: "/images/social-media/globe.svg",
};

export function PlatformIcon({ platform }: { platform: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
      <Image
        src={PLATFORM_ICON_SRC[platform] || PLATFORM_ICON_SRC.other}
        alt=""
        width={22}
        height={22}
      />
    </div>
  );
}

const STATUS_TONE: Record<IncidentStatus, string> = {
  New: "bg-[#E4F9EE] text-[#1FAE5C]",
  Reviewing: "bg-[#FFEDED] text-[#D14343]",
  Confirmed: "bg-[#EDEDED] text-[#6B7280]",
  Rejected: "bg-[#FFEDED] text-[#D14343]",
};

export function IncidentStatusPill({ status }: { status: IncidentStatus }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-3 text-[12px] font-medium ${STATUS_TONE[status]}`}
    >
      {status}
    </span>
  );
}
