"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isGateChecking, setIsGateChecking] = useState(true);
  const hideBottomNav =
    pathname === "/subscription" ||
    pathname.startsWith("/subscription/") ||
    pathname === "/verification" ||
    pathname === "/cloak-watch/personalised-appearance" ||
    pathname.startsWith("/cloak-watch/new-post") ||
    pathname.startsWith("/cloak-watch/post/");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (
      status === "authenticated" &&
      ((session as any)?.sessionExpired || !(session as any)?.user?.id)
    ) {
      void signOut({ callbackUrl: "/?authStep=EMAIL" });
      return;
    }

    if (status !== "authenticated") {
      setIsGateChecking(true);
      return;
    }

    const identityVerificationStatus = String(
      (session?.user as any)?.identityVerificationStatus || "",
    ).toUpperCase();

    if (!identityVerificationStatus) {
      setIsGateChecking(false);
      router.replace("/?authStep=IDENTITY");
      return;
    }

    let isCancelled = false;

    const enforceProtectedGate = async () => {
      try {
        const mediaRes = await fetch("/api/reference-media", {
          cache: "no-store",
        });
        const mediaData = await mediaRes.json().catch(() => null);
        const mediaCount = Array.isArray(mediaData?.data)
          ? mediaData.data.length
          : 0;

        if (!isCancelled && mediaCount < 3) {
          setIsGateChecking(false);
          router.replace("/reference-media?mode=onboarding");
          return;
        }
      } catch (error) {
        console.error("Failed to enforce protected onboarding gate:", error);
      }

      if (!isCancelled) {
        setIsGateChecking(false);
      }
    };

    setIsGateChecking(true);
    void enforceProtectedGate();

    return () => {
      isCancelled = true;
    };
  }, [status, session, router]);

  if (status === "loading" || isGateChecking) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-white font-sf-pro-display">
        <div className="h-10 w-10 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-white text-slate-900 overflow-hidden font-sf-pro-display">
      <main
        className={`flex-1 relative min-h-0 overflow-y-auto no-scrollbar ${hideBottomNav ? "" : "px-4 py-4"}`}
      >
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
