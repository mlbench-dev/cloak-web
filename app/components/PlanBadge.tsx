import Image from "next/image";
import type { PlanCode } from "@/models/Subscription";

// Cloak Pro shows the crown icon; Freemium shows nothing next to the
// username.
export default function PlanBadge({
  plan,
  className = "",
}: {
  plan: PlanCode;
  className?: string;
}) {
  if (plan !== "CLOAK_PRO") return null;

  return (
    <Image
      src="/images/icons/tabler_crown-filled.png"
      alt="Cloak Pro"
      width={16}
      height={16}
      className={`h-4 w-4 shrink-0 object-contain ${className}`}
      unoptimized
    />
  );
}
