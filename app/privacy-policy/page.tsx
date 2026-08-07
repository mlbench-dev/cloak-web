"use client";

import {
  ChevronLeft,
  Database,
  Eye,
  FileText,
  Lock,
  Share2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

type InfoCard = {
  title: string;
  body: string[];
  icon: React.ComponentType<{ className?: string }>;
};

const infoCards: InfoCard[] = [
  {
    title: "What we collect",
    icon: Database,
    body: [
      "We collect account information such as your username, email address, and profile information required to create and maintain your account.",
      "As part of our identity verification process, we may collect government-issued identity documents, identity document images and information contained within those documents, and facial photographs submitted for verification.",
      "We may also collect information you submit through reports, including images and other content provided as part of a report.",
      "We may collect limited technical and device information necessary to operate, secure, and improve our services.",
    ],
  },
  {
    title: "Identity verification",
    icon: UserCheck,
    body: [
      "Cloak uses identity verification technology to help verify the identity of users.",
      "As part of this process, we may process government-issued identity documents, facial photographs, and biometric facial information.",
      "The information collected during identity verification is used to perform identity verification and related matching processes.",
    ],
  },
  {
    title: "Biometric and facial data",
    icon: Eye,
    body: [
      "As part of the identity verification process, Cloak may process facial images and biometric facial information.",
      "Where applicable, facial embeddings may be generated from submitted facial images and stored for the purpose of identity verification and AI-based matching.",
      "Biometric and facial information is processed only for the purposes described in this Privacy Policy and is protected using appropriate security measures.",
    ],
  },
  {
    title: "How we use your information",
    icon: FileText,
    body: [
      "We use the information we collect to create and manage your account, perform identity verification, and process verification and matching requests.",
      "We may use information to process and verify reports submitted through Cloak, provide Cloak Watch and related services, and improve the accuracy, security, and reliability of our services.",
      "We may also use information to detect and prevent fraud, misuse, and unauthorized activity and to comply with applicable legal and regulatory requirements.",
      "We do not use your reports to train third-party AI models without your explicit consent.",
    ],
  },
  {
    title: "Sharing and disclosure",
    icon: Share2,
    body: [
      "Verified reports may be shared anonymously with moderators and community members when you submit information publicly.",
      "We may share information with service providers that help us operate, host, secure, store, and deliver our services.",
      "We may disclose information when required by law, legal process, or a valid request from a competent authority. Where legally permitted, we will provide notice before making such disclosures.",
    ],
  },
  {
    title: "Data security",
    icon: Lock,
    body: [
      "We take reasonable technical and organizational measures to protect your information against unauthorized access, loss, misuse, alteration, or disclosure.",
      "Information submitted through Cloak is protected using appropriate security measures during transmission and storage.",
    ],
  },
  {
    title: "Data retention",
    icon: ShieldCheck,
    body: [
      "We retain personal information only for as long as necessary to provide our services, fulfill the purposes described in this Privacy Policy, maintain security, comply with legal obligations, and resolve disputes.",
      "This may include government identity documents, facial images and biometric information, facial embeddings, verification results, and user-submitted reports.",
      "Specific retention periods may vary depending on the type of information and the purpose for which it is processed. Specific retention periods will be added once these periods have been formally defined.",
    ],
  },
  {
    title: "Minimum age requirement",
    icon: UserCheck,
    body: [
      "Cloak is intended for individuals who are 18 years of age or older.",
      "You must be at least 18 years old to create an account and use Cloak's identity verification services.",
      "We do not knowingly collect or process information from individuals under the age of 18 for the purpose of providing these services.",
    ],
  },
  {
    title: "Third-party service providers",
    icon: Database,
    body: [
      "Cloak may use third-party service providers to support the operation, hosting, storage, security, and delivery of its services.",
      "Where applicable, these providers may process information on our behalf and are expected to handle such information in accordance with appropriate security and confidentiality requirements.",
      "A specific list of third-party providers may be added to this Privacy Policy where required or considered appropriate.",
    ],
  },
  {
    title: "Changes to this Privacy Policy",
    icon: FileText,
    body: [
      "We may update this Privacy Policy from time to time to reflect changes to our services, data-processing practices, or legal requirements.",
      "When changes are made, the updated version will be made available through Cloak with the revised Last Updated date.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="flex h-full flex-col bg-white font-sf-pro-display">
      {/* Header */}
      <header className="z-10 flex items-center justify-between bg-white px-4 py-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="p-2"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
        </button>

        <h1 className="text-lg font-semibold text-[#2D2D2D]">
          Privacy Policy
        </h1>

        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2">
        <div className="space-y-3">
          {/* Introduction */}
          <div className="flex items-start gap-3 px-1 py-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14C3CF]/12">
              <Lock className="h-4 w-4 text-[#14C3CF]" />
            </div>

            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold leading-5 text-[#2D2D2D]">
                Your privacy matters.
              </h2>

              <p className="mt-2 text-[13px] leading-5 text-[#8F98A0]">
                We believe privacy is a right. This Privacy Policy explains
                what information we collect, how we use it, how we protect it,
                and how it may be shared when you use Cloak.
              </p>

              <p className="mt-2 text-[13px] leading-5 text-[#8F98A0]">
                <span className="font-medium text-[#2D2D2D]">
                  Last updated
                </span>{" "}
                · August 7, 2026
              </p>
            </div>
          </div>

          {/* Privacy Information Cards */}
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
                      {card.body.map((paragraph, index) => (
                        <p
                          key={`${card.title}-${index}`}
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

          {/* General Privacy Statement */}
          <section className="rounded-[18px] bg-[#F6F6F6] px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14C3CF]/12">
                <ShieldCheck className="h-4 w-4 text-[#14C3CF]" />
              </div>

              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold leading-5 text-[#2D2D2D]">
                  Your privacy
                </h3>

                <p className="mt-2 text-[13px] leading-5 text-[#8F98A0]">
                  We aim to be transparent about the information we collect
                  and how it is used. If you have questions about this Privacy
                  Policy or how your information is handled, please contact us
                  through the appropriate support channel.
                </p>
              </div>
            </div>
          </section>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}