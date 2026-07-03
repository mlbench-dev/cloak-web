import Image from "next/image";

type OnboardingStepLayoutProps = {
  logoSrc?: string;
  logoAlt?: string;
  headline: string;
  subheadline: string;
  heroSrc?: string;
  heroAlt?: string;
  title: string;
  description: string;
  buttonLabel: string;
  onNext?: () => void;
  currentStep?: number;
  totalSteps?: number;
};

export default function OnboardingStepLayout({
  logoSrc,
  logoAlt = "Cloak logo",
  headline,
  subheadline,
  heroSrc,
  heroAlt = "Onboarding image",
  title,
  description,
  buttonLabel,
  onNext,
  currentStep = 1,
  totalSteps = 3,
}: OnboardingStepLayoutProps) {
  return (
    <main className="flex h-full flex-col bg-[#F5F5F5] text-[#2D2D2D]">
      <section className="px-6 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="flex flex-col items-center gap-1.5 text-center">
          {logoSrc ? (
            <Image src={logoSrc} alt={logoAlt} width={124} height={69} priority className="h-auto w-[124px]" />
          ) : (
            <div className="flex h-[86px] w-[86px] items-center justify-center rounded-2xl border border-dashed border-[#00BCD4]/40 bg-white text-xs font-medium text-[#00BCD4]">
              Logo
            </div>
          )}

          <div className="space-y-1">
            <span className="sr-only">{headline}</span>
            <p className="text-[15px] font-normal text-[#7C8A93] 2xl:text-[18px]">{subheadline}</p>
          </div>
        </div>
      </section>

      <section className="relative mt-2 flex flex-1 flex-col justify-end overflow-hidden">
        <div className="relative flex-1">
          {heroSrc ? (
            <Image src={heroSrc} alt={heroAlt} fill priority className="object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#ececec_100%)]">
              <div className="rounded-3xl border border-dashed border-[#00BCD4]/35 bg-white/80 px-6 py-3 text-sm font-medium text-[#00BCD4] shadow-sm">
                Add step image here
              </div>
            </div>
          )}



          <div className="absolute inset-x-0 bottom-0 h-[315px] bg-[linear-gradient(180deg,rgba(15,15,15,0)_0%,rgba(0,0,0,0.74)_100%)]" />

          <div className="absolute inset-x-0 bottom-0 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-white ">
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-[28px] font-bold leading-tight tracking-[-0.04em] 2xl:text-[34px]">{title}</h2>
                <p className="max-w-[20rem] text-[15px] leading-6 text-white/92 2xl:max-w-[24rem] 2xl:text-[18px] 2xl:leading-7">{description}</p>
              </div>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }, (_, index) => {
                  const step = index + 1;
                  const isActive = step === currentStep;

                  return (
                    <span
                      key={step}
                      className={`h-3 rounded-full ${
                        isActive ? "w-7 bg-[#00BCD4]" : "w-3 bg-white"
                      }`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onNext}
                className="flex h-14 w-full items-center justify-center rounded-full bg-[#00BCD4] text-[18px] font-medium text-white shadow-[0_10px_24px_rgba(0,188,212,0.3)] 2xl:h-16 2xl:text-[20px]"
              >
                <span>{buttonLabel}</span>
                <span className="ml-2 text-xl leading-none 2xl:text-2xl">›</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
