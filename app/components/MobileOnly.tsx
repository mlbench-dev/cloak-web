import Image from "next/image";

export default function MobileOnly({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="app-mobile-viewport bg-[#00BCD4] md:hidden">{children}</div>

      <div className="hidden min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-10 md:flex">
        <div className="w-full max-w-xl rounded-[32px] border border-[#D9E4EA] bg-white p-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-6">
            <Image
              src="/images/icons/cloakLogo.svg"
              alt="Cloak logo"
              width={124}
              height={69}
              className="h-auto w-[124px]"
            />

            <div className="space-y-3">
              <p className="text-lg font-semibold text-[#1F2937]">Mobile view only</p>
              <p className="text-sm leading-7 text-[#6B7280]">
                This web app is optimized for mobile screens. Open it on a phone-sized screen to
                view the data and use the full experience.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#D9E4EA] bg-[#F8FAFC] px-5 py-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-[#00BCD4]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <rect x="7" y="2" width="10" height="20" rx="2" />
                <circle cx="12" cy="18.5" r="0.75" fill="currentColor" />
              </svg>
              <span className="text-sm font-medium text-[#334155]">Resize smaller or open on mobile</span>
            </div>

            <div className="h-px w-24 bg-[#E5E7EB]" />

            <div className="flex items-center gap-3 rounded-2xl border border-[#D9E4EA] bg-[#F8FAFC] px-5 py-3">
              <svg
                className="h-4 w-4 flex-shrink-0 text-[#00BCD4]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium text-[#334155]">Your data is protected.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
