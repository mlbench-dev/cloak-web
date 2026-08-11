import type { PlanCode } from "@/models/Subscription";

const PLAN_BADGE_STYLES: Record<
  Exclude<PlanCode, "FREEMIUM">,
  { label: string; className: string }
> = {
  BOOST: { label: "BOOST", className: "bg-[#1CCF84]/12 text-[#1CCF84]" },
  CLOAK_PRO: { label: "PRO", className: "bg-[#14C3CF]/12 text-[#14C3CF]" },
};

// Renders nothing for Freemium — there's nothing to badge.
export default function PlanBadge({
  plan,
  className = "",
}: {
  plan: PlanCode;
  className?: string;
}) {
  if (plan === "FREEMIUM") return null;
  const style = PLAN_BADGE_STYLES[plan];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${style.className} ${className}`}
    >
      {style.label}
    </span>
  );
}
