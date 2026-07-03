"use client";

import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  Lock,
  Share2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

type InfoCard = {
  title: string;
  body: string[];
  icon: React.ComponentType<{ className?: string }>;
};

type ToggleRow = {
  title: string;
  description: string;
  enabled: boolean;
};

const infoCards: InfoCard[] = [
  {
    title: "What we collect",
    icon: Database,
    body: [
      "Account details (username, email), reports you submit, and minimal device info used to keep your account secure.",
      "We never use your reports to train third-party models without explicit consent.",
    ],
  },
  {
    title: "How we use it",
    icon: Eye,
    body: [
      "To verify reports, power Cloak Watch alerts, and improve detection accuracy for the community.",
      "We never use your reports to train third-party models without explicit consent.",
    ],
  },
  {
    title: "Sharing & disclosure",
    icon: Share2,
    body: [
      "Verified reports may be shared anonymously with moderators and community members when you submit them publicly.",
      "We only disclose data to authorities when legally required and will notify you when possible.",
    ],
  },
  {
    title: "Security",
    icon: Lock,
    body: [
      "End-to-end encryption for uploads, encrypted storage at rest, and regular independent audits.",
    ],
  },
];

const controls: ToggleRow[] = [
  {
    title: "Analytics",
    description: "Help improve detection with anonymous usage data.",
    enabled: true,
  },
  {
    title: "Personalized alerts",
    description: "Tailor Cloak Watch alerts to your activity.",
    enabled: false,
  },
  {
    title: "Share reports with community",
    description: "Default visibility for new reports you submit.",
    enabled: true,
  },
];

function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div
      className={`relative h-6 w-11 rounded-full transition-colors ${
        enabled ? "bg-[#14C3CF]" : "bg-[#E5E7EB]"
      }`}
    >
      <div
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "left-6" : "left-1"
        }`}
      />
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const [controlState, setControlState] = useState(controls);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleToggle = (title: string) => {
    setControlState((current) =>
      current.map((control) =>
        control.title === title
          ? { ...control, enabled: !control.enabled }
          : control,
      ),
    );
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;

    setDeleteError(null);
    setIsDeleting(true);

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete account.");
      }

      await signOut({ callbackUrl: "/?authStep=EMAIL" });
    } catch (error) {
      console.error("Delete account error:", error);
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete account.",
      );
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      <header className="flex items-center justify-between px-4 py-4 bg-white z-10">
        <button onClick={() => window.history.back()} className="p-2">
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>
        <h1 className="text-lg font-semibold text-[#2D2D2D]">
          Privacy Policy
        </h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 pt-2 no-scrollbar">
        <div className="space-y-3">
          <div className="flex items-start gap-3 px-1 py-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14C3CF]/12">
              <Lock className="h-4 w-4 text-[#14C3CF]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold leading-5 text-[#2D2D2D]">
                Your data, your control.
              </h2>
              <p className="mt-2 text-[13px] leading-5 text-[#8F98A0]">
                We believe privacy is a right, not a setting. Here&apos;s
                exactly what we collect, how we use it, and the controls you
                have.
              </p>
              <p className="mt-2 text-[13px] leading-5 text-[#8F98A0]">
                <span className="font-medium text-[#2D2D2D]">Last updated</span>{" "}
                · April 17, 2026
              </p>
            </div>
          </div>

          {infoCards.map((card) => {
            const Icon = card.icon;

            return (
              <section
                key={card.title}
                className="rounded-[18px] bg-[#F6F6F6] px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14C3CF]/12">
                    <Icon className="h-4 w-4 text-[#14C3CF]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-semibold leading-5 text-[#2D2D2D]">
                      {card.title}
                    </h3>
                    <div className="mt-2 space-y-3">
                      {card.body.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="text-[13px] leading-5 text-[#8F98A0]"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          <section className="rounded-[18px] bg-[#F6F6F6] px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14C3CF]/12">
                <SlidersHorizontal className="h-4 w-4 text-[#14C3CF]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-semibold leading-5 text-[#2D2D2D]">
                  Your controls
                </h3>
                <div className="mt-3">
                  {controlState.map((control, index) => (
                    <button
                      type="button"
                      key={control.title}
                      onClick={() => handleToggle(control.title)}
                      className={`flex items-start justify-between gap-3 py-3 ${
                        index !== controls.length - 1
                          ? "border-b border-[#E7E7E7]"
                          : ""
                      } w-full text-left`}
                    >
                      <div className="min-w-0">
                        <h4 className="text-[14px] font-semibold leading-5 text-[#2D2D2D]">
                          {control.title}
                        </h4>
                        <p className="mt-1 text-[13px] leading-5 text-[#8F98A0]">
                          {control.description}
                        </p>
                      </div>
                      <div className="shrink-0 pt-1">
                        <Toggle enabled={control.enabled} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[18px] bg-[#F6F6F6] px-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14C3CF]/12">
                  <Download className="h-4 w-4 text-[#14C3CF]" />
                </div>
                <div>
                  <p className="text-[15px] font-medium leading-5 text-[#2D2D2D]">
                    Download My Data
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-[#8F98A0]">
                    Get a copy of everything.
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8F98A0]" />
            </button>
            <div className="border-t border-[#E7E7E7]" />
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              disabled={isDeleting}
              className="flex w-full items-center justify-between gap-3 py-4 text-left disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14C3CF]/12">
                  <Trash2 className="h-4 w-4 text-[#14C3CF]" />
                </div>
                <div>
                  <p className="text-[15px] font-medium leading-5 text-[#2D2D2D]">
                    {isDeleting ? "Deleting Account..." : "Delete My Account"}
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-[#8F98A0]">
                    Permanently delete your account and data.
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8F98A0]" />
            </button>
          </section>

          <div className="h-14" />
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[340px] rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-bold text-[#2D2D2D]">
                Delete My Account
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (isDeleting) return;
                  setDeleteError(null);
                  setShowDeleteModal(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F5] text-[#8F98A0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-[15px] leading-6 text-[#8F98A0]">
              Are you sure you want to permanently delete your account and all
              associated data? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-500">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (isDeleting) return;
                  setDeleteError(null);
                  setShowDeleteModal(false);
                }}
                disabled={isDeleting}
                className="flex-1 rounded-full bg-[#F5F5F5] px-4 py-4 text-[15px] font-medium text-[#2D2D2D] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 rounded-full bg-red-500 px-4 py-4 text-[15px] font-medium text-white disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
