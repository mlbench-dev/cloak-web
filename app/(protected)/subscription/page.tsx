"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  boostProtectionPlan,
  cloakProPlan,
  freemiumFeatures,
} from "./_lib/plans";
import { cancelActiveSubscription, startCheckout } from "./_lib/checkout";
import {
  fetchSubscriptionStatus,
  formatPlanDate,
  type SubscriptionStatus,
} from "./_lib/status";

type ActiveModal = "cloak-pro" | "boost-protection" | null;
type PendingUpgrade = "cloak-pro" | "boost-protection" | null;

export default function SubscriptionPage() {
  const searchParams = useSearchParams();
  // Arrived back from PayFast (success or cancel) — history behind this
  // page is the checkout, so back goes to Profile instead. Captured once,
  // since the param is stripped below.
  const [cameFromCheckout] = useState(() => searchParams.has("checkout"));
  const backHref = cameFromCheckout ? "/profile" : undefined;
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [pendingUpgrade, setPendingUpgrade] = useState<PendingUpgrade>(null);
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
    const checkout = searchParams.get("checkout");
    if (!checkout) return;

    if (checkout === "cancelled") {
      toast.error("Checkout cancelled. No payment was made.", {
        id: "checkout-cancelled",
      });
    }
    window.history.replaceState(null, "", "/subscription");
  }, [searchParams]);

  const handleUpgrade = async (plan: "boost-protection" | "cloak-pro") => {
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
        <SubscriptionHeader backHref={backHref} />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#14C3CF]/20 border-t-[#14C3CF]" />
        </div>
      </SubscriptionScreenShell>
    );
  }

  const plan = subscription?.plan || "FREEMIUM";
  const currentPlanSummary =
    plan === "BOOST" ? boostProtectionPlan : plan === "CLOAK_PRO" ? cloakProPlan : null;
  const accessUntilDate = formatPlanDate(subscription?.currentPeriodEnd || null);
  const isCancelledButStillActive =
    currentPlanSummary !== null && Boolean(subscription?.cancelAtPeriodEnd);
  const pendingUpgradePlan =
    pendingUpgrade === "cloak-pro" ? cloakProPlan : pendingUpgrade === "boost-protection" ? boostProtectionPlan : null;

  return (
    <SubscriptionScreenShell>
      <SubscriptionHeader backHref={backHref} />

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

        <div className="mt-5">
          <SectionLabel>Whats Included</SectionLabel>
          <FeatureListCard
            features={currentPlanSummary ? currentPlanSummary.features : freemiumFeatures}
            tone={currentPlanSummary ? currentPlanSummary.tone : "slate"}
          />
        </div>

        {currentPlanSummary && (
          <div className="mt-5">
            <SectionLabel>Billing &amp; Payment</SectionLabel>
            <BillingCard
              price={currentPlanSummary.price}
              nextChargeDate={accessUntilDate}
            />
          </div>
        )}

        {plan !== "CLOAK_PRO" && (
          <div className="mt-5">
            <SectionLabel>Explore Premium Plans</SectionLabel>
            <div className="space-y-4">
              <PlanUpsellCard
                plan={cloakProPlan}
                onClick={() => setActiveModal("cloak-pro")}
              />
              {plan === "FREEMIUM" && (
                <PlanUpsellCard
                  plan={boostProtectionPlan}
                  onClick={() => setActiveModal("boost-protection")}
                />
              )}
            </div>
          </div>
        )}

        {currentPlanSummary && !isCancelledButStillActive && (
          <CancelSubscriptionBlock
            accessUntilDate={accessUntilDate}
            onCancel={() => setShowCancelConfirm(true)}
          />
        )}

        <PrivacyFooter />
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

      <UpgradeModal
        open={activeModal === "boost-protection"}
        plan={boostProtectionPlan}
        title="Get more control with Protection Boost"
        ctaLabel="Unlock Protection Boost - $4.99"
        onClose={() => setActiveModal(null)}
        onConfirm={() => {
          setActiveModal(null);
          setPendingUpgrade("boost-protection");
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
