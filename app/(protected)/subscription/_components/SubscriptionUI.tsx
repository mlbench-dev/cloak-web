"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  ShieldCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PlanFeature, PlanSummary, PlanTone } from "../_lib/plans";

const toneClasses: Record<
  PlanTone,
  {
    iconBox: string;
    iconColor: string;
    featureText: string;
    checkColor: string;
    button: string;
    privacyBadge: string;
  }
> = {
  slate: {
    iconBox: "bg-[#7E8C93]",
    iconColor: "text-white",
    featureText: "text-[#8F98A0]",
    checkColor: "text-[#9AA3AA]",
    button: "bg-slate-200 text-slate-500",
    privacyBadge: "bg-[#7E8C93]/10 text-[#7E8C93]",
  },
  teal: {
    iconBox: "bg-[#14C3CF]",
    iconColor: "text-white",
    featureText: "text-[#2D2D2D]",
    checkColor: "text-[#14C3CF]",
    button: "bg-[#14C3CF] text-white",
    privacyBadge: "bg-[#14C3CF]/10 text-[#14C3CF]",
  },
  green: {
    iconBox: "bg-gradient-to-br from-[#1CCF84] to-[#2BCF9D]",
    iconColor: "text-white",
    featureText: "text-[#2D2D2D]",
    checkColor: "text-[#27C989]",
    button: "bg-gradient-to-r from-[#1FCB8C] to-[#29D37A] text-white",
    privacyBadge: "bg-[#1CCF84]/10 text-[#1CCF84]",
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
  return (
    <header className="flex items-center justify-between px-4 py-4 bg-white z-10">
      <button onClick={() => window.history.back()} className="p-2">
        <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
      </button>
      <h1 className="text-lg font-semibold text-[#2D2D2D]">Subscription</h1>
      <div className="w-10" />
    </header>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[14px] font-medium text-[#8F98A0]">{children}</p>
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
    <div className="rounded-[26px] border border-[#EAEAEA] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${styles.iconBox}`}
        >
          <Icon className={`h-5 w-5 ${styles.iconColor}`} />
        </div>
        <div>
          <p className="text-[16px] font-semibold leading-5 text-[#2D2D2D]">
            {title}
          </p>
          <p className="mt-1 text-[14px] leading-4 text-[#8F98A0]">{statusLabel}</p>
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
    <div className="overflow-hidden rounded-[28px] border border-[#EAEAEA] bg-white px-4">
      {features.map((feature, index) => {
        const Icon = feature.icon;

        return (
          <div
            key={feature.label}
            className={`flex items-center gap-3 py-4 ${index !== features.length - 1 ? "border-b border-[#EFEFEF]" : ""}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${styles.iconBox}`}
            >
              <Icon className={`h-5 w-5 ${styles.iconColor}`} />
            </div>
            <span
              className={`flex-1 text-[15px] leading-5 ${styles.featureText}`}
            >
              {feature.label}
            </span>
            <Check className={`h-5 w-5 shrink-0 ${styles.checkColor}`} />
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
      className="flex w-full items-center gap-3 rounded-[28px] border border-[#EAEAEA] bg-white px-4 py-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-5 text-[#2D2D2D]">
          {plan.name}
        </p>
        <p className="mt-1 text-[15px] font-medium leading-5 text-[#14C3CF]">
          {plan.priceLine}
        </p>
        <p className="mt-0.5 text-[12px] leading-4 text-[#B0B5BB]">
          {plan.zarPriceLine}
        </p>
        <p className="mt-1 text-[14px] leading-5 text-[#8F98A0]">
          {plan.description}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${styles.iconBox}`}
        >
          <Icon className={`h-5 w-5 ${styles.iconColor}`} />
        </div>
        <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
      </div>
    </button>
  );
}

export function BillingCard({
  price,
  nextChargeDate,
}: {
  price: string;
  nextChargeDate: string;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#EAEAEA] bg-white px-4">
      <div className="flex items-center justify-between border-b border-[#EFEFEF] py-4">
        <span className="text-[15px] leading-5 text-[#2D2D2D]">
          Payment Method
        </span>
        <span className="inline-flex items-center gap-1.5 text-[16px] font-semibold leading-5 text-black">
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
      <div className="flex items-center justify-between py-4">
        <span className="text-[15px] leading-5 text-[#2D2D2D]">
          Next Charge:{" "}
          <span className="font-medium text-[#14C3CF]">{price}</span>
        </span>
        <span className="text-[15px] leading-5 text-[#9CA3AF]">
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
        className="w-full rounded-full border border-[#ECECEC] bg-white px-4 py-4 text-[15px] font-medium text-[#F05B5B] disabled:opacity-60"
      >
        {isCancelling ? "Cancelling..." : "Cancel Subscription"}
      </button>
      <p className="mt-4 text-[14px] leading-5 text-[#8F98A0]">
        If you cancel , you can still access the subscription till{" "}
        {accessUntilDate} , after that your plan will be downgraded
      </p>
    </div>
  );
}

export function PrivacyFooter() {
  return (
    <div className="mt-auto flex flex-col items-center px-4 pb-7 pt-10 text-center">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#14C3CF]/12 text-[#14C3CF]">
        <ShieldCheck className="h-4 w-4" />
      </div>
      <p className="text-[14px] leading-5 text-[#8F98A0]">
        We care about your privacy
      </p>
      <div className="mt-6 flex items-center gap-10">
        <Link
          href="/privacy-policy"
          className="text-[14px] font-medium text-[#14C3CF] underline"
        >
          Privacy Policy
        </Link>
        <Link
          href="/privacy-policy"
          className="text-[14px] font-medium text-[#14C3CF] underline"
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
  if (!open) return null;

  const styles = toneClasses[plan.tone];
  const Icon = plan.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      <div className="relative z-10 w-full rounded-t-[28px] bg-[#F8F8F8] px-4 pb-6 pt-2 font-sf-pro-display shadow-[0_-16px_40px_rgba(15,23,42,0.14)]">
        <div className="mx-auto mb-8 h-1.5 w-[76px] rounded-full bg-[#9CB2BB]" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-[#D8D8D8]"
        >
          <X className="h-4 w-4" />
        </button>
        <div
          className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] ${styles.iconBox}`}
        >
          <Icon className={`h-7 w-7 ${styles.iconColor}`} />
        </div>
        <h2 className="mx-auto max-w-[290px] text-center text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-[#111827]">
          {title}
        </h2>
        <p className="mx-auto mt-2 text-center text-[13px] leading-5 text-[#9CA3AF]">
          {plan.zarPriceLine}
        </p>
        <p className="mb-3 mt-10 text-[14px] font-medium text-[#8F98A0]">
          What You Will Get
        </p>
        <FeatureListCard features={plan.features} tone={plan.tone} />
        <button
          type="button"
          onClick={onConfirm}
          className={`mt-7 w-full rounded-full px-4 py-4 text-[15px] font-medium ${styles.button}`}
        >
          {ctaLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-[#EEEEEE] px-4 py-4 text-[15px] font-medium text-[#9AA3AA]"
        >
          Not Now
        </button>
      </div>
    </div>
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
          <h3 className="text-[20px] font-bold text-[#2D2D2D]">{title}</h3>
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
            className="h-14 flex-1 rounded-full bg-[#F5F5F5] font-semibold text-[#2D2D2D] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`h-14 flex-1 rounded-full font-semibold text-white disabled:opacity-60 ${
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
