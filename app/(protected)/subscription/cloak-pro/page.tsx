"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  BillingCard,
  CancelSubscriptionBlock,
  ConfirmDialog,
  CurrentPlanCard,
  FeatureListCard,
  SectionLabel,
  SubscriptionHeader,
  SubscriptionScreenShell,
} from "../_components/SubscriptionUI";
import { cloakProPlan } from "../_lib/plans";
import { cancelActiveSubscription } from "../_lib/checkout";
import { fetchSubscriptionStatus, formatPlanDate } from "../_lib/status";

export default function CloakProSubscriptionPage() {
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [accessUntilDate, setAccessUntilDate] = useState("—");

  useEffect(() => {
    void fetchSubscriptionStatus().then((status) => {
      setAccessUntilDate(formatPlanDate(status?.currentPeriodEnd || null));
    });
  }, []);

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelActiveSubscription();
      toast.success(
        `Cancelled — you'll keep access until ${accessUntilDate}.`,
      );
      setShowCancelConfirm(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel subscription.",
      );
    } finally {
      setIsCancelling(false);
    }
  };

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
            nextChargeDate={accessUntilDate}
          />
        </div>

        <div className="mt-5">
          <SectionLabel>Whats Included</SectionLabel>
          <FeatureListCard features={cloakProPlan.features} tone={cloakProPlan.tone} />
        </div>

        <CancelSubscriptionBlock
          accessUntilDate={accessUntilDate}
          onCancel={() => setShowCancelConfirm(true)}
        />
      </div>

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Subscription"
        message={`You'll keep access until ${accessUntilDate}, after which your plan will be downgraded to Freemium. This can't be undone once the period ends.`}
        confirmLabel="Cancel Subscription"
        confirmVariant="danger"
        isConfirming={isCancelling}
        onConfirm={() => void handleCancel()}
        onClose={() => setShowCancelConfirm(false)}
      />
    </SubscriptionScreenShell>
  );
}
