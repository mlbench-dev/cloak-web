"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Crown,
  ShieldCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PlanFeature, PlanSummary, PlanTone } from "../_lib/plans";
import { useRouter } from "next/navigation";
import { goBack } from "@/lib/navigation";
import BottomSheet from "@/app/components/BottomSheet";
const toneClasses: Record<
  PlanTone,
  {
    iconBox: string;
    iconColor: string;
    featureText: string;
    checkColor: string;
    button: string;
  }
> = {
  slate: {
    iconBox: "bg-[#7E8C93]",
    iconColor: "text-white",
    featureText: "text-[#839297]",
    checkColor: "text-[#839297]",
    button: "bg-slate-200 text-slate-500",
  },
  teal: {
    iconBox: "bg-gradient-to-b from-[#14C3CF] to-[#0FA4AE]",
    iconColor: "text-white",
    featureText: "text-[#2B2B2B]",
    checkColor: "text-[#14C3CF]",
    button: "bg-gradient-to-b from-[#14C3CF] to-[#0FA4AE] text-white",
  },
};

export function SubscriptionScreenShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-[calc(100%+2rem)] flex-col bg-white font-sf-pro-display ${className}`}
    >
      {children}
    </div>
  );
}

export function SubscriptionHeader() {
  const router = useRouter();
  return (
    <header className="flex items-center justify-between px-4 py-4 bg-white z-10">
      <button type="button" onClick={() => goBack(router, "/profile")} className="p-2">
        <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
      </button>
      <h1 className="text-[16px] font-medium text-[#2B2B2B]">Subscription</h1>
      <div className="w-10" />
    </header>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[12px] leading-4 text-[#839297]">{children}</p>
  );
}

export function CurrentPlanCard({
  icon: Icon,
  title,
  tone,
  statusLabel = "Active",
}: {
  icon: LucideIcon;
  title: string;
  tone: PlanTone;
  statusLabel?: string;
}) {
  const styles = toneClasses[tone];

  return (
    <div className="rounded-[20px] border border-[#EDEDED] bg-white px-3 py-3">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.iconBox}`}
        >
          <Icon className={`h-[18px] w-[18px] ${styles.iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium leading-5 text-[#2B2B2B]">
            {title}
          </p>
          <p className="truncate text-[12px] leading-4 text-[#839297]">
            {statusLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FeatureListCard({
  features,
  tone,
}: {
  features: PlanFeature[];
  tone: PlanTone;
}) {
  const styles = toneClasses[tone];

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#EDEDED] bg-white px-3">
      {features.map((feature, index) => {
        const Icon = feature.icon;

        return (
          <div
            key={feature.label}
            className={`flex items-center gap-2.5 py-2.5 ${index !== features.length - 1 ? "border-b border-[#F0F0F0]" : ""}`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${styles.iconBox}`}
            >
              <Icon className={`h-4 w-4 ${styles.iconColor}`} />
            </div>
            <span
              className={`flex-1 text-[13px] leading-5 ${styles.featureText}`}
            >
              {feature.label}
            </span>
            <Check className={`h-4 w-4 shrink-0 ${styles.checkColor}`} />
          </div>
        );
      })}
    </div>
  );
}

export function PlanUpsellCard({
  plan,
  onClick,
}: {
  plan: PlanSummary;
  onClick: () => void;
}) {
  const styles = toneClasses[plan.tone];
  const Icon = plan.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-[20px] border border-[#EDEDED] bg-white px-3 py-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-5 text-[#2B2B2B]">
          {plan.name}
        </p>
        <p className="mt-0.5 text-[14px] leading-5 text-[#14C3CF]">
          {plan.priceLine}
        </p>
        <p className="mt-1 text-[12px] leading-4 text-[#839297]">
          {plan.description}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles.iconBox}`}
        >
          <Icon className={`h-[18px] w-[18px] ${styles.iconColor}`} />
        </div>
        <ArrowRight className="h-4 w-4 text-[#839297]" />
      </div>
    </button>
  );
}

export function BillingCard({
  price,
  nextChargeDate,
  // When the plan is cancelled (lapses at period end) there is no next
  // charge — the date is when access ends, so label it accordingly instead
  // of implying another payment (SUB-002).
  isCancelled = false,
}: {
  price: string;
  nextChargeDate: string;
  isCancelled?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#EDEDED] bg-white px-3">
      <div className="flex items-center justify-between border-b border-[#F0F0F0] py-3">
        <span className="text-[13px] leading-5 text-[#2B2B2B]">
          Payment Method
        </span>
        <span className="inline-flex items-center gap-1 text-[15px] font-semibold leading-5 text-black">
          <svg
            aria-hidden="true"
            viewBox="0 0 14 17"
            className="h-[17px] w-[14px] fill-current"
          >
            <path d="M11.1 9.02c.02 2.12 1.86 2.82 1.88 2.83-.02.05-.29.97-.95 1.91-.57.81-1.16 1.62-2.09 1.64-.91.02-1.2-.54-2.24-.54-1.04 0-1.36.52-2.22.56-.9.03-1.58-.89-2.16-1.7C2.14 12.01 1.23 8.88 2.43 6.8c.59-1.03 1.65-1.68 2.8-1.7.87-.02 1.69.58 2.22.58.53 0 1.53-.72 2.57-.61.44.02 1.68.18 2.48 1.35-.06.04-1.48.86-1.4 2.6Zm-1.7-5.14c.48-.58.81-1.39.72-2.2-.69.03-1.52.46-2.01 1.04-.45.52-.85 1.34-.74 2.13.77.06 1.55-.39 2.03-.97Z" />
          </svg>
          <span>Pay</span>
        </span>
      </div>
      <div className="flex items-center justify-between py-3">
        <span className="text-[13px] leading-5 text-[#2B2B2B]">
          {isCancelled ? (
            "Access until"
          ) : (
            <>
              Next Charge: <span className="text-[#14C3CF]">{price}</span>
            </>
          )}
        </span>
        <span className="text-[13px] leading-5 text-[#839297]">
          {nextChargeDate}
        </span>
      </div>
    </div>
  );
}

export function CancelSubscriptionBlock({
  accessUntilDate,
  onCancel,
  isCancelling = false,
}: {
  accessUntilDate: string;
  onCancel?: () => void;
  isCancelling?: boolean;
}) {
  return (
    <div className="mt-auto pt-8 pb-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={isCancelling}
        className="h-11 w-full rounded-full border border-[#EDEDED] bg-white px-4 text-[14px] text-[#F30131] disabled:opacity-60"
      >
        {isCancelling ? "Cancelling..." : "Cancel Subscription"}
      </button>
      <p className="mt-2.5 text-[11px] leading-4 text-[#839297]">
        If you cancel , you can still access the subscription till{" "}
        {accessUntilDate} , after that your plan will be downgraded
      </p>
    </div>
  );
}

export function PrivacyFooter() {
  return (
    <div className="mt-auto flex flex-col items-center px-4 pb-7 pt-10 text-center">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg border border-[#14C3CF]/30 bg-[#14C3CF]/10 text-[#14C3CF]">
        <ShieldCheck className="h-4 w-4" />
      </div>
      <p className="text-[12px] leading-4 text-[#839297]">
        We care about your privacy
      </p>
      <div className="mt-5 flex items-center gap-14">
        <Link
          href="/privacy-policy"
          className="text-[13px] text-[#14C3CF] underline"
        >
          Privacy Policy
        </Link>
        <Link
          href="/privacy-policy"
          className="text-[13px] text-[#14C3CF] underline"
        >
          Terms of Service
        </Link>
      </div>
    </div>
  );
}

export function UpgradeModal({
  open,
  plan,
  title,
  ctaLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  plan: PlanSummary;
  title: string;
  ctaLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const styles = toneClasses[plan.tone];
  const Icon = plan.icon;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      panelClassName="max-h-[90dvh] overflow-y-auto shadow-[0_-16px_40px_rgba(15,23,42,0.14)]"
    >
      <div className="px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6">
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${styles.iconBox}`}
        >
          <Icon className={`h-6 w-6 ${styles.iconColor}`} />
        </div>
        <h2 className="mx-auto max-w-[260px] text-center text-[22px] font-medium leading-7 text-[#2B2B2B]">
          {title}
        </h2>
        <p className="mb-2 mt-6 text-[12px] leading-4 text-[#839297]">
          What You Will Get
        </p>
        <FeatureListCard features={plan.features} tone={plan.tone} />
        <button
          type="button"
          onClick={onConfirm}
          className={`mt-6 h-[45px] w-full rounded-full px-4 text-[14px] ${styles.button}`}
        >
          {ctaLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2.5 h-[45px] w-full rounded-full bg-[#F5F5F5] px-4 text-[14px] text-[#839297]"
        >
          Not Now
        </button>
      </div>
    </BottomSheet>
  );
}

export function FreemiumPlanIcon() {
  return <Crown className="h-5 w-5 text-white" />;
}

// Shared "are you sure" step for the two actions that actually change
// billing — cancelling and starting checkout — matching the existing
// centered-modal pattern used for Log Out / Delete Account in profile.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Go Back",
  isConfirming = false,
  confirmVariant = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[340px] space-y-6 rounded-[32px] bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-[#2D2D2D]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-[16px] leading-relaxed text-[#8F98A0]">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="h-11 flex-1 rounded-full bg-[#F5F5F5] font-medium text-[#2D2D2D] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`h-11 flex-1 rounded-full font-medium text-white disabled:opacity-60 ${
              confirmVariant === "danger" ? "bg-red-500" : "bg-[#14C3CF]"
            }`}
          >
            {isConfirming ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
