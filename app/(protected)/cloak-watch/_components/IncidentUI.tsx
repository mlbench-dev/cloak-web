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

export function PlatformIcon({
  platform,
  size = "sm",
}: {
  platform: string;
  size?: "sm" | "lg";
}) {
  const isLarge = size === "lg";
  return (
    <div
      className={
        isLarge
          ? "flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white"
      }
    >
      <Image
        src={PLATFORM_ICON_SRC[platform] || PLATFORM_ICON_SRC.other}
        alt=""
        width={isLarge ? 52 : 16}
        height={isLarge ? 52 : 16}
      />
    </div>
  );
}

// Bare 16px platform glyph (no box) — for spots that supply their own
// container, e.g. the 26px badge on the evidence image.
export function PlatformGlyph({ platform, size = 16 }: { platform: string; size?: number }) {
  return (
    <Image
      src={PLATFORM_ICON_SRC[platform] || PLATFORM_ICON_SRC.other}
      alt=""
      width={size}
      height={size}
    />
  );
}

const STATUS_TONE: Record<IncidentStatus, string> = {
  New: "bg-[#F2FEF4] text-[#34C657]",
  Reviewing: "bg-[#FFEDED] text-[#D14343]",
  Confirmed: "bg-[#EDEDED] text-[#6B7280]",
  Rejected: "bg-[#FFEDED] text-[#D14343]",
};

export function IncidentStatusPill({ status }: { status: IncidentStatus }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] ${STATUS_TONE[status]}`}
    >
      {status}
    </span>
  );
}
