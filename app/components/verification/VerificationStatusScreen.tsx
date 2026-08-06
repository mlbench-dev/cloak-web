"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, History, Info } from "lucide-react";
import { useRouter } from "next/navigation";

type VerificationStatusScreenProps = {
  status: "APPROVED" | "REJECTED";
  failureReason?: string | null;
  verificationResult?: {
    average_similarity?: number;
    threshold?: number;
    scores?: Record<string, number>;
    detail?: string;
    status?: string;
    verified?: boolean;
  } | null;
  verificationHistory?: Array<{
    status?: string | null;
    reason?: string | null;
  }>;
};

function getFriendlyScoreLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized === "face1_vs_id") return "Protected photo 1 match";
  if (normalized === "face2_vs_id") return "Protected photo 2 match";
  if (normalized === "face3_vs_id") return "Protected photo 3 match";
  if (normalized === "face1") return "Protected photo 1";
  if (normalized === "face2") return "Protected photo 2";
  if (normalized === "face3") return "Protected photo 3";
  if (normalized === "id_card") return "Identity document";
  return label.replaceAll("_", " ");
}

export function formatVerificationReason(reason: string) {
  return reason
    .replace(/\bface1_vs_id\b/gi, "Protected photo 1 match")
    .replace(/\bface2_vs_id\b/gi, "Protected photo 2 match")
    .replace(/\bface3_vs_id\b/gi, "Protected photo 3 match")
    .replace(/\bface1\b/gi, "protected photo 1")
    .replace(/\bface2\b/gi, "protected photo 2")
    .replace(/\bface3\b/gi, "protected photo 3")
    .replace(/\bid_card\b/gi, "identity document");
}

function ShieldStatusIcon({ status }: { status: "APPROVED" | "REJECTED" }) {
  const isApproved = status === "APPROVED";

  if (!isApproved) {
    return (
      <div className="flex h-[152px] w-[152px] items-center justify-center rounded-full">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="120"
            height="120"
            rx="60"
            fill="#FF383C"
            fillOpacity="0.04"
          />
          <path
            d="M60.0001 100C59.8575 100 59.7148 99.9834 59.5752 99.9501C59.4781 99.927 57.1586 99.3671 53.7311 97.8011C50.6014 96.3711 45.8795 93.7789 41.1573 89.5511C35.8515 84.8006 31.6256 78.9974 28.5971 72.3028C24.8356 63.9877 22.9285 54.2788 22.9285 43.4454V36.1687C22.9285 35.6646 23.1355 35.1826 23.5012 34.8357C23.8668 34.4886 24.3593 34.3069 24.8623 34.3333C24.902 34.3353 29.2235 34.5234 35.5435 32.9058C39.2452 31.9583 42.9009 30.585 46.4089 28.824C50.7911 26.6242 54.9566 23.8083 58.7899 20.4546C59.4828 19.8485 60.5173 19.8485 61.2101 20.4546C65.0434 23.8083 69.2089 26.6242 73.5911 28.824C77.0991 30.585 80.7548 31.9583 84.4565 32.9058C90.7765 34.5234 95.0982 34.3353 95.141 34.3332C95.6449 34.307 96.135 34.4885 96.5005 34.8356C96.8662 35.1825 97.0715 35.6646 97.0715 36.1687V43.4454C97.0715 54.2788 95.1643 63.9877 91.4029 72.3028C88.3745 78.9974 84.1486 84.8006 78.8427 89.5511C74.1206 93.779 69.3986 96.3711 66.2689 97.8011C62.8415 99.3671 60.5219 99.9271 60.4248 99.9501C60.2854 99.9834 60.1428 100 60.0001 100ZM26.6041 37.9907V43.4454C26.6041 53.703 28.3842 62.8642 31.8951 70.6747C34.689 76.8905 38.5846 82.2791 43.4734 86.6907C47.8373 90.6287 52.2077 93.0499 55.1056 94.3876C57.4404 95.4653 59.2227 96.0335 60.0002 96.2581C60.776 96.034 62.5589 95.4658 64.8946 94.3876C67.7924 93.0499 72.1628 90.6287 76.5267 86.6907C81.4156 82.279 85.3112 76.8905 88.1051 70.6747C91.6159 62.8642 93.396 53.7029 93.396 43.4454V37.9907C91.4032 37.9073 87.9914 37.5905 83.708 36.508C79.7318 35.5031 75.807 34.04 72.043 32.1594C67.8043 30.0416 63.7596 27.3859 60.0001 24.2542C56.2407 27.3859 52.1959 30.0416 47.9572 32.1594C44.1932 34.04 40.2685 35.5031 36.2922 36.508C32.0088 37.5905 28.5969 37.9073 26.6041 37.9907Z"
            fill="#FF3B30"
          />
          <path
            d="M60.0002 93.8647C59.1545 93.5916 57.7654 93.0952 56.0647 92.3101C53.3108 91.0387 49.1568 88.7371 45.0066 84.9918C40.3545 80.7938 36.6453 75.6612 33.9823 69.7365C30.605 62.2231 28.8926 53.3775 28.8926 43.4455V40.1254C30.9851 39.927 33.6973 39.5242 36.8529 38.7267C40.9888 37.6815 45.0691 36.1606 48.9801 34.2065C52.8255 32.2853 56.525 29.932 60.0001 27.1982C63.4752 29.932 67.1747 32.2852 71.0202 34.2065C74.9311 36.1606 79.0113 37.6814 83.1473 38.7267C86.303 39.5242 89.0151 39.9271 91.1076 40.1254V43.4455C91.1076 53.3775 89.3953 62.2231 86.0179 69.7366C83.3549 75.6612 79.6458 80.7938 74.9936 84.9919C70.8434 88.7371 66.6894 91.0386 63.9354 92.3101C62.2341 93.0954 60.8455 93.5917 60.0002 93.8647Z"
            fill="#FF3B30"
          />
          <path
            d="M60.4999 61.7754L50.1249 72.1504C50.0109 72.2681 49.874 72.3612 49.7227 72.424C49.5713 72.4868 49.4087 72.5179 49.2449 72.5154C49.0784 72.5194 48.9128 72.49 48.7578 72.429C48.6028 72.3681 48.4616 72.2768 48.3424 72.1604C48.2261 72.0412 48.1348 71.9 48.0738 71.745C48.0129 71.59 47.9835 71.4244 47.9874 71.2579C47.9874 70.9163 48.1091 70.6229 48.3524 70.3779L58.7274 60.0029L48.3524 49.6279C48.2335 49.5128 48.1396 49.3743 48.0768 49.2211C48.014 49.0679 47.9836 48.9034 47.9874 48.7379C47.9871 48.5736 48.0194 48.4109 48.0825 48.2592C48.1456 48.1074 48.2382 47.9698 48.355 47.8542C48.4718 47.7386 48.6104 47.6473 48.7627 47.5857C48.915 47.5241 49.0781 47.4935 49.2424 47.4954C49.5841 47.4954 49.8774 47.6171 50.1224 47.8604L60.4999 58.2354L70.8749 47.8604C70.9901 47.7415 71.1286 47.6477 71.2817 47.5849C71.4349 47.522 71.5994 47.4916 71.7649 47.4954C71.9366 47.4954 72.0949 47.5279 72.2399 47.5929C72.4302 47.6707 72.5983 47.7944 72.729 47.9531C72.8597 48.1118 72.9491 48.3004 72.9889 48.5021C73.0288 48.7038 73.0181 48.9122 72.9576 49.1087C72.8971 49.3052 72.7888 49.4836 72.6424 49.6279L62.2674 60.0029L72.6424 70.3779C72.76 70.4934 72.8535 70.6311 72.9172 70.783C72.981 70.935 73.0139 71.0981 73.0139 71.2629C73.0139 71.4277 72.981 71.5909 72.9172 71.7428C72.8535 71.8948 72.76 72.0325 72.6424 72.1479C72.4094 72.3804 72.0941 72.5116 71.7649 72.5129C71.5994 72.5168 71.4349 72.4863 71.2817 72.4235C71.1286 72.3607 70.9901 72.2669 70.8749 72.1479L60.4999 61.7754Z"
            fill="white"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`flex h-[152px] w-[152px] items-center justify-center rounded-full 
      }`}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {" "}
        <rect
          width="120"
          height="120"
          rx="60"
          fill="#DBF5F6"
          fillOpacity="0.32"
        />
        <path
          d="M60.0001 100C59.8575 100 59.7148 99.9834 59.5752 99.9501C59.4781 99.927 57.1586 99.3671 53.7311 97.8011C50.6014 96.3711 45.8795 93.7789 41.1573 89.5511C35.8515 84.8006 31.6256 78.9974 28.5971 72.3028C24.8356 63.9877 22.9285 54.2788 22.9285 43.4454V36.1687C22.9285 35.6646 23.1355 35.1826 23.5012 34.8357C23.8668 34.4886 24.3593 34.3069 24.8623 34.3333C24.902 34.3353 29.2235 34.5234 35.5435 32.9058C39.2452 31.9583 42.9009 30.585 46.4089 28.824C50.7911 26.6242 54.9566 23.8083 58.7899 20.4546C59.4828 19.8485 60.5173 19.8485 61.2101 20.4546C65.0434 23.8083 69.2089 26.6242 73.5911 28.824C77.0991 30.585 80.7548 31.9583 84.4565 32.9058C90.7765 34.5234 95.0982 34.3353 95.141 34.3332C95.6449 34.307 96.135 34.4885 96.5005 34.8356C96.8662 35.1825 97.0715 35.6646 97.0715 36.1687V43.4454C97.0715 54.2788 95.1643 63.9877 91.4029 72.3028C88.3745 78.9974 84.1486 84.8006 78.8427 89.5511C74.1206 93.779 69.3986 96.3711 66.2689 97.8011C62.8415 99.3671 60.5219 99.9271 60.4248 99.9501C60.2854 99.9834 60.1428 100 60.0001 100ZM26.6041 37.9907V43.4454C26.6041 53.703 28.3842 62.8642 31.8951 70.6747C34.689 76.8905 38.5846 82.2791 43.4734 86.6907C47.8373 90.6287 52.2077 93.0499 55.1056 94.3876C57.4404 95.4653 59.2227 96.0335 60.0002 96.2581C60.776 96.034 62.5589 95.4658 64.8946 94.3876C67.7924 93.0499 72.1628 90.6287 76.5267 86.6907C81.4156 82.279 85.3112 76.8905 88.1051 70.6747C91.6159 62.8642 93.396 53.7029 93.396 43.4454V37.9907C91.4032 37.9073 87.9914 37.5905 83.708 36.508C79.7318 35.5031 75.807 34.04 72.043 32.1594C67.8043 30.0416 63.7596 27.3859 60.0001 24.2542C56.2407 27.3859 52.1959 30.0416 47.9572 32.1594C44.1932 34.04 40.2685 35.5031 36.2922 36.508C32.0088 37.5905 28.5969 37.9073 26.6041 37.9907Z"
          fill="#00C3D0"
        />
        <path
          d="M60.0002 93.8647C59.1545 93.5916 57.7654 93.0952 56.0647 92.3101C53.3108 91.0387 49.1568 88.7371 45.0066 84.9918C40.3545 80.7938 36.6453 75.6612 33.9823 69.7365C30.605 62.2231 28.8926 53.3775 28.8926 43.4455V40.1254C30.9851 39.927 33.6973 39.5242 36.8529 38.7267C40.9888 37.6815 45.0691 36.1606 48.9801 34.2065C52.8255 32.2853 56.525 29.932 60.0001 27.1982C63.4752 29.932 67.1747 32.2852 71.0202 34.2065C74.9311 36.1606 79.0113 37.6814 83.1473 38.7267C86.303 39.5242 89.0151 39.9271 91.1076 40.1254V43.4455C91.1076 53.3775 89.3953 62.2231 86.0179 69.7366C83.3549 75.6612 79.6458 80.7938 74.9936 84.9919C70.8434 88.7371 66.6894 91.0386 63.9354 92.3101C62.2341 93.0954 60.8455 93.5917 60.0002 93.8647Z"
          fill="#00C3D0"
        />
        <path
          d="M54.2564 69.1575C62.6197 55.0472 72.2913 46.5905 75.419 44.1305C75.8805 43.7675 76.5293 43.7733 76.9444 44.1885C77.3553 44.5994 77.3948 45.2655 77.0109 45.7018C64.3484 60.0934 59.2418 70.2123 56.2186 76.7889C55.7455 77.8182 54.2624 77.8531 53.6163 76.9227C50.8438 72.9293 48.1667 68.815 45.9046 66.7047C45.0568 65.9139 44.2443 65.783 43.5602 65.7482C42.7777 65.7083 42.4343 64.7381 43.0101 64.2066C44.2637 63.0495 46.2299 62.0456 48.7431 63.364C51.5932 64.859 54.2564 69.1575 54.2564 69.1575Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

function BenefitRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-4 border-t border-[#EDF2F4] py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF8F9] text-[#17C1CD]">
        {icon}
      </div>
      <p className="text-[16px] leading-6 text-[#1C1C1E]">{text}</p>
    </div>
  );
}

export default function VerificationStatusScreen({
  status,
  failureReason,
  verificationResult,
  verificationHistory,
}: VerificationStatusScreenProps) {
  const router = useRouter();
  const isApproved = status === "APPROVED";
  const scoreEntries = Object.entries(verificationResult?.scores ?? {}).filter(
    ([, value]) => typeof value === "number" && !Number.isNaN(value),
  );
  const hasScoreMismatch =
    typeof verificationResult?.average_similarity === "number" &&
    typeof verificationResult?.threshold === "number";
  const showActualReason = Boolean(failureReason) || hasScoreMismatch;
  const recentHistory = (verificationHistory ?? []).filter(
    (entry) => entry?.status || entry?.reason,
  );

  return (
    <main className="min-h-full bg-white font-sf-pro-display text-[#111111]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),16px)]">
        <header className="flex items-center justify-between bg-white z-10">
          <button
            onClick={() => {
              router.push("/profile");
            }}
            className="p-2"
          >
            <ChevronLeft className="h-6 w-6 text-[#8F98A0]" />
          </button>
          <h1 className="text-lg font-semibold text-[#2D2D2D]">Verification</h1>
          <div className="w-10" />
        </header>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col items-center pt-8 text-center">
            <ShieldStatusIcon status={status} />

            <h2 className="mt-9 text-[28px] font-semibold leading-[1.18] tracking-[-0.02em] text-[#161616]">
              {isApproved ? "Identity Verified" : "Verification Unsuccessful"}
            </h2>

            <p className="mt-4 max-w-[330px] text-[14px] leading-7 text-[#9DA3AE]">
              {isApproved
                ? "Your identity has been successfully verified. You can now enjoy all the benefits of being a verified Cloak user."
                : "We couldn’t verify your identity using the submitted document."}
            </p>
          </div>

          {isApproved ? (
            <section className="mt-10 rounded-[30px] border border-[#E8F0F1] bg-[#FBFEFE] px-5 py-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <h3 className="text-[17px] font-semibold leading-6 text-[#16C2CE]">
                You&apos;re now verified
              </h3>
              <div className="mt-4">
                <BenefitRow
                  icon={
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 28 28"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {" "}
                      <rect width="28" height="28" rx="8" fill="#DBF5F6" />{" "}
                      <path
                        d="M14.0002 6.2998L7.7002 9.0998V13.2998C7.7002 17.1848 10.3882 20.8178 14.0002 21.6998C17.6122 20.8178 20.3002 17.1848 20.3002 13.2998V9.0998L14.0002 6.2998ZM16.1562 16.7998L14.0002 15.5048L11.8512 16.7998L12.4182 14.3498L10.5212 12.7118L13.0272 12.4948L14.0002 10.1848L14.9732 12.4878L17.4792 12.7048L15.5822 14.3498L16.1562 16.7998Z"
                        fill="#00C3D0"
                      />{" "}
                    </svg>
                  }
                  text="Verified badge on your profile"
                />
                <BenefitRow
                  icon={
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 28 28"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect width="28" height="28" rx="8" fill="#DBF5F6" />
                      <path
                        d="M16.8 17.4994V18.8994H7V17.4994C7 17.4994 7 14.6994 11.9 14.6994C16.8 14.6994 16.8 17.4994 16.8 17.4994ZM14.35 10.8494C14.35 10.3649 14.2063 9.89119 13.9371 9.48829C13.6679 9.08539 13.2853 8.77137 12.8376 8.58594C12.3899 8.4005 11.8973 8.35198 11.422 8.44652C10.9468 8.54105 10.5102 8.77439 10.1676 9.11703C9.82495 9.45967 9.59161 9.89622 9.49708 10.3715C9.40254 10.8467 9.45106 11.3393 9.6365 11.787C9.82193 12.2347 10.136 12.6173 10.5389 12.8865C10.9418 13.1558 11.4154 13.2994 11.9 13.2994C12.5498 13.2994 13.1729 13.0413 13.6324 12.5819C14.0919 12.1224 14.35 11.4992 14.35 10.8494ZM16.758 14.6994C17.1883 15.0325 17.5404 15.4557 17.7896 15.9395C18.0387 16.4232 18.1788 16.9557 18.2 17.4994V18.8994H21V17.4994C21 17.4994 21 14.9584 16.758 14.6994ZM16.1 8.39944C15.6182 8.3972 15.1472 8.54121 14.749 8.81244C15.1742 9.40656 15.4028 10.1188 15.4028 10.8494C15.4028 11.58 15.1742 12.2923 14.749 12.8864C15.1472 13.1577 15.6182 13.3017 16.1 13.2994C16.7498 13.2994 17.3729 13.0413 17.8324 12.5819C18.2919 12.1224 18.55 11.4992 18.55 10.8494C18.55 10.1997 18.2919 9.57649 17.8324 9.11703C17.3729 8.65756 16.7498 8.39944 16.1 8.39944Z"
                        fill="#00C3D0"
                      />
                    </svg>
                  }
                  text="Increased trust across the community"
                />
                <BenefitRow
                  icon={
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 28 28"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect width="28" height="28" rx="8" fill="#DBF5F6" />
                      <path
                        d="M9.59411 6.64942C9.57234 6.64922 9.55086 6.65444 9.5316 6.66461C9.51235 6.67478 9.49593 6.68958 9.48382 6.70768C9.47171 6.72578 9.46429 6.7466 9.46224 6.76828C9.46019 6.78996 9.46356 6.81181 9.47205 6.83186L9.54752 7.01003L10.883 10.1239C10.8921 10.1451 10.9066 10.1635 10.925 10.1773C10.9435 10.1911 10.9652 10.1998 10.9881 10.2026C11.011 10.2053 11.0342 10.2019 11.0553 10.1929C11.0765 10.1838 11.0949 10.1693 11.1087 10.1508L13.5736 6.85942C13.5882 6.83992 13.5971 6.81673 13.5993 6.79246C13.6015 6.76818 13.5969 6.74377 13.586 6.72197C13.5751 6.70017 13.5583 6.68184 13.5376 6.66902C13.5169 6.65621 13.493 6.64942 13.4686 6.64942H9.59411ZM19.3791 7.50451L18.0246 10.6667C18.0161 10.6866 18.0127 10.7084 18.0146 10.73C18.0166 10.7516 18.0239 10.7724 18.0358 10.7905C18.0478 10.8086 18.0641 10.8235 18.0832 10.8338C18.1023 10.844 18.1237 10.8494 18.1454 10.8494H21.4594C21.4828 10.8494 21.5058 10.8432 21.526 10.8313C21.5462 10.8195 21.5628 10.8024 21.5742 10.782C21.5856 10.7615 21.5913 10.7384 21.5907 10.715C21.5902 10.6916 21.5833 10.6688 21.571 10.6489L19.6111 7.48712C19.5985 7.46677 19.5805 7.45027 19.5591 7.43942C19.5377 7.42856 19.5138 7.42377 19.4899 7.42557C19.4659 7.42736 19.443 7.43566 19.4235 7.44958C19.404 7.4635 19.3886 7.4825 19.3791 7.50451ZM8.38924 7.48844L6.43 10.6489C6.41766 10.6688 6.41085 10.6916 6.41029 10.715C6.40973 10.7384 6.41544 10.7615 6.42682 10.782C6.4382 10.8024 6.45484 10.8195 6.47501 10.8313C6.49519 10.8432 6.51816 10.8494 6.54157 10.8494H9.85563C9.87735 10.8494 9.89872 10.844 9.91783 10.8337C9.93694 10.8233 9.9532 10.8084 9.96513 10.7903C9.97707 10.7721 9.98431 10.7513 9.98622 10.7297C9.98812 10.7081 9.98463 10.6863 9.97605 10.6663L8.61892 7.50583C8.60922 7.48436 8.59391 7.4659 8.57461 7.45238C8.55531 7.43887 8.53273 7.4308 8.50924 7.42902C8.48574 7.42724 8.46221 7.43182 8.44109 7.44227C8.41998 7.45273 8.40207 7.46867 8.38924 7.48844ZM18.5043 6.64942H14.388C14.3761 6.64934 14.3645 6.65259 14.3544 6.6588C14.3442 6.665 14.336 6.67392 14.3307 6.68453C14.3254 6.69515 14.3231 6.70705 14.3242 6.71887C14.3253 6.7307 14.3297 6.74199 14.3368 6.75147L16.9592 10.2447C16.9659 10.2537 16.9748 10.2607 16.9851 10.2651C16.9954 10.2695 17.0067 10.2712 17.0178 10.2698C17.0289 10.2685 17.0395 10.2643 17.0484 10.2575C17.0574 10.2508 17.0644 10.2419 17.0688 10.2316L18.4496 7.01036L18.5611 6.7367C18.565 6.72731 18.5666 6.7171 18.5658 6.70696C18.5649 6.69681 18.5616 6.68703 18.5561 6.67845C18.5506 6.66987 18.5431 6.66275 18.5343 6.65769C18.5254 6.65263 18.5155 6.6498 18.5053 6.64942H18.5043ZM13.4424 20.2994L10.5079 11.9818C10.4993 11.9576 10.4834 11.9367 10.4625 11.922C10.4415 11.9072 10.4164 11.8994 10.3908 11.8994H6.44346C6.42059 11.8994 6.39816 11.9057 6.37874 11.9178C6.35931 11.9298 6.34366 11.9471 6.33357 11.9676C6.32348 11.9881 6.31936 12.0111 6.32167 12.0338C6.32399 12.0566 6.33264 12.0782 6.34666 12.0963L13.4342 21.2776C13.4582 21.3086 13.4924 21.3302 13.5308 21.3384C13.5691 21.3467 13.6092 21.341 13.6438 21.3225C13.6787 21.3042 13.7057 21.274 13.7201 21.2373C13.7345 21.2007 13.7353 21.1601 13.7223 21.123L13.4424 20.2994ZM21.5569 11.8994H17.6096C17.584 11.8994 17.5592 11.9073 17.5383 11.9221C17.5175 11.9368 17.5018 11.9577 17.4934 11.9818L14.2712 21.1089C14.2577 21.1472 14.2582 21.1891 14.2728 21.227C14.2873 21.265 14.3149 21.2965 14.3506 21.316C14.3863 21.3353 14.4277 21.3413 14.4674 21.333C14.5072 21.3246 14.5426 21.3024 14.5675 21.2703L21.6537 12.0963C21.6677 12.0782 21.6764 12.0566 21.6787 12.0338C21.681 12.0111 21.6769 11.9881 21.6668 11.9676C21.6567 11.9471 21.641 11.9298 21.6216 11.9178C21.6022 11.9057 21.5798 11.8994 21.5569 11.8994ZM14.1052 8.18931L15.9427 10.6394C15.9573 10.6589 15.9662 10.6821 15.9684 10.7064C15.9706 10.7307 15.966 10.7551 15.9551 10.7769C15.9442 10.7987 15.9274 10.817 15.9067 10.8298C15.8859 10.8426 15.8621 10.8494 15.8377 10.8494H12.1627C12.1383 10.8494 12.1144 10.8426 12.0937 10.8298C12.0729 10.817 12.0562 10.7987 12.0453 10.7769C12.0344 10.7551 12.0298 10.7307 12.032 10.7064C12.0341 10.6821 12.0431 10.6589 12.0577 10.6394L13.8952 8.18931C13.9074 8.17301 13.9233 8.15978 13.9415 8.15067C13.9597 8.14155 13.9798 8.13681 14.0002 8.13681C14.0206 8.13681 14.0406 8.14155 14.0589 8.15067C14.0771 8.15978 14.093 8.17301 14.1052 8.18931ZM13.8755 18.3714L11.6541 12.0743C11.6471 12.0545 11.645 12.0334 11.6479 12.0126C11.6508 11.9918 11.6586 11.972 11.6707 11.9549C11.6828 11.9377 11.6989 11.9238 11.7175 11.9141C11.7361 11.9045 11.7568 11.8994 11.7778 11.8994H16.2226C16.2435 11.8994 16.2642 11.9045 16.2828 11.9141C16.3015 11.9238 16.3175 11.9377 16.3296 11.9549C16.3418 11.972 16.3496 11.9918 16.3525 12.0126C16.3554 12.0334 16.3532 12.0545 16.3463 12.0743L14.1239 18.3714C14.1148 18.3969 14.0981 18.419 14.0759 18.4347C14.0538 18.4503 14.0273 18.4587 14.0002 18.4587C13.9731 18.4587 13.9466 18.4503 13.9244 18.4347C13.9023 18.419 13.8855 18.3969 13.8765 18.3714H13.8755Z"
                        fill="#00C3D0"
                      />
                    </svg>
                  }
                  text="Stand out from the fake accounts"
                />
              </div>
            </section>
          ) : (
            <>
              <section className="mt-10 rounded-[30px] border border-[#F3ECEC] bg-[#FFFCFC] px-5 py-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <h3 className="text-[17px] font-semibold leading-6 text-[#F04B43]">
                  {showActualReason
                    ? "Verification result"
                    : "Possible reasons"}
                </h3>
                {showActualReason ? (
                  <div className="mt-4 space-y-4 text-left">
                    {failureReason ? (
                      <p className="text-[16px] leading-7 text-[#272727]">
                        {formatVerificationReason(failureReason)}
                      </p>
                    ) : null}
                    {hasScoreMismatch ? (
                      <div className="rounded-[20px] bg-white/90 px-4 py-4">
                        <div className="flex items-center justify-between text-[15px] leading-6 text-[#272727]">
                          <span>Average similarity</span>
                          <span className="font-semibold">
                            {(
                              verificationResult?.average_similarity! * 100
                            ).toFixed(2)}
                            %
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[15px] leading-6 text-[#272727]">
                          <span>Required threshold</span>
                          <span className="font-semibold">
                            {(verificationResult?.threshold! * 100).toFixed(2)}%
                          </span>
                        </div>
                        {scoreEntries.length > 0 ? (
                          <div className="mt-4 space-y-2 border-t border-[#F0E2E2] pt-3">
                            {scoreEntries.map(([label, value]) => (
                              <div
                                key={label}
                                className="flex items-center justify-between text-[14px] leading-6 text-[#6B7280]"
                              >
                                <span>{getFriendlyScoreLabel(label)}</span>
                                <span className="font-medium text-[#272727]">
                                  {(value * 100).toFixed(2)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <ul className="mt-4 list-disc space-y-4 pl-5 text-[16px] leading-7 text-[#272727] marker:text-[#272727]">
                    <li>The document image is blurry or unclear</li>
                    <li>Information couldn&apos;t be read properly</li>
                    <li>The document may be expired</li>
                    <li>
                      The document doesn&apos;t match your account details
                    </li>
                  </ul>
                )}
              </section>

              <section className="mt-7 rounded-[22px] border border-[#EBF1F2] bg-[#FCFEFE] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[#1CC5D0]">
                    <Info className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-semibold leading-6 text-[#272727]">
                      Need help?
                    </h3>
                    <p className="mt-1 text-[14px] leading-6 text-[#3A3A3C]">
                      Please ensure your document is clear, valid, and fully
                      visible before trying again.
                    </p>
                  </div>
                </div>
              </section>

              {recentHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={() => router.push("/verification/history")}
                  className="mt-7 flex items-center justify-between rounded-[22px] border border-[#EBF1F2] bg-[#FCFEFE] px-5 py-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF8F9] text-[#17C1CD]">
                      <History
                        className="h-[18px] w-[18px]"
                        strokeWidth={2.1}
                      />
                    </div>
                    <span className="text-[16px] font-semibold leading-6 text-[#272727]">
                      Verification History
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#9CA3AE]" />
                </button>
              ) : null}

              <div className="mt-auto space-y-4 pt-10">
                <button
                  type="button"
                  onClick={() => router.push("/profile?verification=document")}
                  className="flex h-[58px] w-full items-center justify-center rounded-full bg-[#18C3CF] text-[16px] font-medium text-white"
                >
                  Verify your document
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="flex h-[56px] w-full items-center justify-center rounded-full bg-[#F3F3F3] text-[16px] font-medium text-[#9CA3AE]"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
