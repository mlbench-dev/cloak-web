"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import {
  CurrentPlanCard,
  FeatureListCard,
  PlanUpsellCard,
  PrivacyFooter,
  SectionLabel,
  SubscriptionHeader,
  SubscriptionScreenShell,
  UpgradeModal,
} from "./_components/SubscriptionUI";
import {
  boostProtectionPlan,
  cloakProPlan,
  freemiumFeatures,
} from "./_lib/plans";

type ActiveModal = "cloak-pro" | "boost-protection" | null;

export default function SubscriptionPage() {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  return (
    <SubscriptionScreenShell>
      <SubscriptionHeader />

      <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
        <SectionLabel>Current Plan</SectionLabel>
        <CurrentPlanCard icon={Crown} title="Freemium Plan" tone="slate" />

        <div className="mt-5">
          <SectionLabel>Whats Included</SectionLabel>
          <FeatureListCard features={freemiumFeatures} tone="slate" />
        </div>

        <div className="mt-5">
          <SectionLabel>Explore Premium Plans</SectionLabel>
          <div className="space-y-4">
            <PlanUpsellCard plan={cloakProPlan} onClick={() => setActiveModal("cloak-pro")} />
            <PlanUpsellCard
              plan={boostProtectionPlan}
              onClick={() => setActiveModal("boost-protection")}
            />
          </div>
        </div>

        <PrivacyFooter />
      </div>

      <UpgradeModal
        open={activeModal === "cloak-pro"}
        plan={cloakProPlan}
        title="Unlock everything with Cloak Pro"
        ctaLabel="Upgrade To Cloak Pro- $11.99"
        onClose={() => setActiveModal(null)}
        onConfirm={() => router.push("/subscription/cloak-pro")}
      />

      <UpgradeModal
        open={activeModal === "boost-protection"}
        plan={boostProtectionPlan}
        title="Get more control with Protection Boost"
        ctaLabel="Unlock Protection Boost - $4.99"
        onClose={() => setActiveModal(null)}
        onConfirm={() => router.push("/subscription/boost-protection")}
      />
    </SubscriptionScreenShell>
  );
}
