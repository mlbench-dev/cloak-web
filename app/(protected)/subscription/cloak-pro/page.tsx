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
import { activePlanMeta, cloakProPlan } from "../_lib/plans";

export default function CloakProSubscriptionPage() {
  return (
    <SubscriptionScreenShell>
      <SubscriptionHeader />

      <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto px-5 pb-4">
        <SectionLabel>Current Plan</SectionLabel>
        <CurrentPlanCard icon={cloakProPlan.icon} title={cloakProPlan.name} tone={cloakProPlan.tone} />

        <div className="mt-5">
          <SectionLabel>Billing &amp; Payment</SectionLabel>
          <BillingCard
            price={cloakProPlan.price}
            nextChargeDate={activePlanMeta.nextChargeDate}
          />
        </div>

        <div className="mt-5">
          <SectionLabel>Whats Included</SectionLabel>
          <FeatureListCard features={cloakProPlan.features} tone={cloakProPlan.tone} />
        </div>

        <CancelSubscriptionBlock accessUntilDate={activePlanMeta.accessUntilDate} />
      </div>
    </SubscriptionScreenShell>
  );
}
