"use client";

import { BadgeCheck } from "lucide-react";

type VerifiedBadgeProps = {
  className?: string;
  strokeWidth?: number;
};

export default function VerifiedBadge({
  className = "h-4 w-4 text-[#14C3CF]",
  strokeWidth = 2.2,
}: VerifiedBadgeProps) {
  return <BadgeCheck className={className} strokeWidth={strokeWidth} />;
}
