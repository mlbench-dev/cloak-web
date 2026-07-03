import Image from "next/image";

export default function SplashScreen() {
  return (
    <main className="flex h-full flex-col bg-[#00BCD4] pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <section className="flex flex-1 items-center justify-center px-6">
        <div className="flex flex-col items-center justify-center">
          <Image
            src="/images/icons/logo.svg"
            alt="Cloak logo"
            className="h-auto w-[180px] max-w-full sm:w-[212px]"
            width={212}
            height={101}
            priority
          />
        </div>
      </section>

      <section className="px-4 pb-2">
        <div className="flex items-center justify-between rounded-2xl bg-white/20 px-4 py-4 shadow-lg shadow-cyan-950/10 ring-1 ring-white/15 backdrop-blur-sm">
          <span className="text-sm font-medium text-white 2xl:text-base">Your Data is Protected.</span>
          <div className="">
            <Image
              src="/images/icons/verifyBadge.svg"
              alt=""
              aria-hidden="true"
              className="h-5 w-5"
              width={20}
              height={20}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
