"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { Crown } from "lucide-react";
import {
  BillingCard,
  CancelSubscriptionBlock,
  ConfirmDialog,
  CurrentPlanCard,
  FeatureListCard,
  PaymentReceivedView,
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
import {
  canRewindToSubscription,
  peekCheckoutResult,
  rewindToSubscription,
  takeCheckoutResult,
  type CheckoutResult,
} from "./_lib/checkoutReturn";

// Read from the real URL, not useSearchParams(): once the param is
// stripped, Next's router cache can still hand a later visit to
// /subscription the old ?checkout=cancelled, re-showing the toast on every
// visit until a full reload.
function readCheckoutParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("checkout");
}

function showCancelledToast() {
  toast.error("Checkout cancelled. No payment was made.", {
    id: "checkout-cancelled",
  });
}

export default function SubscriptionPage() {
  const { update: refreshSession } = useSession();
  // Arrived on a PayFast return URL (?checkout=cancelled, or =success when
  // the success page had nothing to rewind to). Captured once, since the
  // param is stripped below.
  const [checkoutResult] = useState(readCheckoutParam);
  // "Payment received", shown on this entry rather than its own page so
  // browser back can't reach PayFast. Set when rewound to after a payment,
  // or on ?checkout=success when there's nowhere to rewind to.
  const [showPaymentReceived, setShowPaymentReceived] = useState(() =>
    checkoutResult
      ? checkoutResult === "success" && !canRewindToSubscription()
      : peekCheckoutResult() === "success",
  );
  const [sessionRefreshed, setSessionRefreshed] = useState(false);
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
    // Rewound to from a PayFast return page (checkoutReturn.ts) after a
    // full reload; "success" was already picked up by showPaymentReceived's
    // initial state. Not on a return-URL page itself: it's the one leaving
    // the result for the page it rewinds to.
    if (!checkoutResult && takeCheckoutResult() === "cancelled") showCancelledToast();
  }, [checkoutResult]);

  // After a payment: refresh the session (and plan) so the new plan shows
  // once PayFast's ITN has landed — see lib/auth.ts's jwt() callback.
  useEffect(() => {
    if (!showPaymentReceived) return;
    void refreshSession().finally(() => setSessionRefreshed(true));
    void fetchSubscriptionStatus().then((status) => {
      setSubscription(status);
      setLoading(false);
    });
  }, [showPaymentReceived, refreshSession]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      setActiveModal(null);
      setPendingUpgrade(null);
      setIsRedirecting(false);
      // Restored from the back/forward cache — e.g. rewound to after
      // checkout. The plan may have changed meanwhile.
      if (event.persisted) {
        const result = takeCheckoutResult();
        if (result === "cancelled") showCancelledToast();
        if (result === "success") setShowPaymentReceived(true);
        void fetchSubscriptionStatus().then((status) => {
          setSubscription(status);
          setLoading(false);
        });
      }
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // On a PayFast return URL: rewind to the /subscription entry checkout
  // started from, so PayFast's pages aren't behind this one (back into
  // them bounces straight here — a loop). Ref so Strict Mode's re-run
  // doesn't rewind twice.
  const rewoundRef = useRef(false);
  useEffect(() => {
    if (!checkoutResult || rewoundRef.current) return;
    rewoundRef.current = true;
    const result: CheckoutResult = checkoutResult === "success" ? "success" : "cancelled";
    if (rewindToSubscription(result)) return;

    // Nothing to rewind to (e.g. storage blocked): show it here instead
    // ("success" is already showing via showPaymentReceived).
    if (result === "cancelled") showCancelledToast();
    window.history.replaceState(window.history.state, "", "/subscription");
  }, [checkoutResult]);

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

  if (showPaymentReceived) {
    return (
      <PaymentReceivedView
        confirming={!sessionRefreshed}
        onBack={() => setShowPaymentReceived(false)}
      />
    );
  }

  if (loading) {
    return (
      <SubscriptionScreenShell>
        <SubscriptionHeader />
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
      <SubscriptionHeader />

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
