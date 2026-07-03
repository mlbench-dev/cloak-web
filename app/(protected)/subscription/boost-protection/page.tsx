"use client";

import {
  BillingCard,
  CancelSubscriptionBlock,
  CurrentPlanCard,
  FeatureListCard,
  SectionLabel,
  SubscriptionHeader,
  SubscriptionScreenShell,
} from "../_components/SubscriptionUI";
import { activePlanMeta, boostProtectionPlan } from "../_lib/plans";

export default function BoostProtectionSubscriptionPage() {
  return (
    <SubscriptionScreenShell>
      <SubscriptionHeader />

      <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto px-5 pb-4">
        <SectionLabel>Current Plan</SectionLabel>
        <CurrentPlanCard
          icon={boostProtectionPlan.icon}
          title={boostProtectionPlan.name}
          tone={boostProtectionPlan.tone}
        />

        <div className="mt-5">
          <SectionLabel>Billing &amp; Payment</SectionLabel>
          <BillingCard
            price={boostProtectionPlan.price}
            nextChargeDate={activePlanMeta.nextChargeDate}
          />
        </div>

        <div className="mt-5">
          <SectionLabel>Whats Included</SectionLabel>
          <FeatureListCard
            features={boostProtectionPlan.features}
            tone={boostProtectionPlan.tone}
          />
        </div>

        <CancelSubscriptionBlock
          accessUntilDate={activePlanMeta.accessUntilDate}
        />
      </div>
    </SubscriptionScreenShell>
  );
}
