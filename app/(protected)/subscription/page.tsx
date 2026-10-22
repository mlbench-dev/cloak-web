"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Crown } from "lucide-react";
import {
  BillingCard,
  CancelSubscriptionBlock,
  ConfirmDialog,
  CurrentPlanCard,
  FeatureListCard,
  PlanUpsellCard,
  PrivacyFooter,
  SectionLabel,
  SubscriptionHeader,
  SubscriptionScreenShell,
  UpgradeModal,
} from "./_components/SubscriptionUI";
import { cloakProPlan, freemiumFeatures } from "./_lib/plans";
import {
  cancelActiveSubscription,
  startCheckout,
  type PlanSlug,
} from "./_lib/checkout";
import {
  fetchSubscriptionStatus,
  formatPlanDate,
  type SubscriptionStatus,
} from "./_lib/status";
import { useCheckoutBackGuard } from "./_lib/useCheckoutBackGuard";

// Read from the real URL, not useSearchParams(): once the param is
// stripped, Next's router cache can still hand a later visit to
// /subscription the old ?checkout=cancelled, re-showing the toast on every
// visit until a full reload.
function readCheckoutParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("checkout");
}

export default function SubscriptionPage() {
  // Arrived back from PayFast (success or cancel) — history behind this
  // page is the checkout, so back (app or browser) skips over it. Captured
  // once, since the param is stripped below.
  const [checkoutResult] = useState(readCheckoutParam);
  const cameFromCheckout = checkoutResult !== null;
  const [activeModal, setActiveModal] = useState<PlanSlug | null>(null);
  const [pendingUpgrade, setPendingUpgrade] = useState<PlanSlug | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    const status = await fetchSubscriptionStatus();
    setSubscription(status);
    setLoading(false);
  };

  useEffect(() => {
    void fetchSubscriptionStatus().then((status) => {
      setSubscription(status);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const resetCheckoutState = () => {
      setActiveModal(null);
      setPendingUpgrade(null);
      setIsRedirecting(false);
    };

    window.addEventListener("pageshow", resetCheckoutState);

    return () => {
      window.removeEventListener("pageshow", resetCheckoutState);
    };
  }, []);

  useEffect(() => {
    if (!checkoutResult) return;

    if (checkoutResult === "cancelled") {
      toast.error("Checkout cancelled. No payment was made.", {
        id: "checkout-cancelled",
      });
    }
    // Keep the existing state — it may already be the back guard's entry.
    window.history.replaceState(window.history.state, "", "/subscription");
  }, [checkoutResult]);

  // After the param strip above, so the guard is pushed on the clean URL.
  const exitCheckout = useCheckoutBackGuard(cameFromCheckout);
  const onBack = cameFromCheckout ? exitCheckout : undefined;

  const handleUpgrade = async (plan: PlanSlug) => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    try {
      await startCheckout(plan);
      // startCheckout navigates the browser away on success — nothing
      // more to do here. isRedirecting deliberately isn't reset on the
      // success path since the page is about to unload.
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start checkout.",
      );
      setIsRedirecting(false);
      setPendingUpgrade(null);
    }
  };

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelActiveSubscription();
      toast.success(
        "Subscription cancelled — you'll keep access until the end of this billing period.",
      );
      setShowCancelConfirm(false);
      await loadStatus();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel subscription.",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <SubscriptionScreenShell>
        <SubscriptionHeader onBack={onBack} />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
        </div>
      </SubscriptionScreenShell>
    );
  }

  const plan = subscription?.plan || "FREEMIUM";
  const currentPlanSummary = plan === "CLOAK_PRO" ? cloakProPlan : null;
  const accessUntilDate = formatPlanDate(subscription?.currentPeriodEnd || null);
  const isCancelledButStillActive =
    currentPlanSummary !== null && Boolean(subscription?.cancelAtPeriodEnd);
  const pendingUpgradePlan = pendingUpgrade === "cloak-pro" ? cloakProPlan : null;

  return (
    <SubscriptionScreenShell>
      <SubscriptionHeader onBack={onBack} />

      <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto px-5 py-4">
        <SectionLabel>Current Plan</SectionLabel>
        {currentPlanSummary ? (
          <CurrentPlanCard
            icon={currentPlanSummary.icon}
            title={currentPlanSummary.name}
            tone={currentPlanSummary.tone}
            statusLabel={
              isCancelledButStillActive
                ? `Cancelled — active until ${accessUntilDate}`
                : "Active"
            }
          />
        ) : (
          <CurrentPlanCard icon={Crown} title="Freemium Plan" tone="slate" />
        )}

        {currentPlanSummary && (
          <div className="mt-4">
            <SectionLabel>Billing &amp; Payment</SectionLabel>
            <BillingCard
              price={currentPlanSummary.price}
              nextChargeDate={accessUntilDate}
              isCancelled={isCancelledButStillActive}
            />
          </div>
        )}

        <div className="mt-4">
          <SectionLabel>Whats Included</SectionLabel>
          <FeatureListCard
            features={currentPlanSummary ? currentPlanSummary.features : freemiumFeatures}
            tone={currentPlanSummary ? currentPlanSummary.tone : "slate"}
          />
        </div>

        {plan !== "CLOAK_PRO" && (
          <div className="mt-4">
            <SectionLabel>Explore Premium Plans</SectionLabel>
            <PlanUpsellCard
              plan={cloakProPlan}
              onClick={() => setActiveModal("cloak-pro")}
            />
          </div>
        )}

        {currentPlanSummary && !isCancelledButStillActive && (
          <CancelSubscriptionBlock
            accessUntilDate={accessUntilDate}
            onCancel={() => setShowCancelConfirm(true)}
          />
        )}

        {!currentPlanSummary && <PrivacyFooter />}
      </div>

      <UpgradeModal
        open={activeModal === "cloak-pro"}
        plan={cloakProPlan}
        title="Unlock everything with Cloak Pro"
        ctaLabel="Upgrade To Cloak Pro- $11.99"
        onClose={() => setActiveModal(null)}
        onConfirm={() => {
          setActiveModal(null);
          setPendingUpgrade("cloak-pro");
        }}
      />

      <ConfirmDialog
        open={pendingUpgrade !== null}
        title="Confirm Upgrade"
        message={
          pendingUpgradePlan
            ? `You'll be redirected to PayFast to complete your ${pendingUpgradePlan.priceLine} payment (${pendingUpgradePlan.zarPriceLine}).`
            : ""
        }
        confirmLabel={isRedirecting ? "Redirecting..." : "Proceed"}
        confirmVariant="primary"
        isConfirming={isRedirecting}
        onConfirm={() => pendingUpgrade && void handleUpgrade(pendingUpgrade)}
        onClose={() => setPendingUpgrade(null)}
      />

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Subscription"
        message={`You'll keep access until ${accessUntilDate}, after which your plan will be downgraded to Freemium. This can't be undone once the period ends.`}
        confirmLabel="Cancel"
        confirmVariant="danger"
        isConfirming={isCancelling}
        onConfirm={() => void handleCancel()}
        onClose={() => setShowCancelConfirm(false)}
      />
    </SubscriptionScreenShell>
  );
}
