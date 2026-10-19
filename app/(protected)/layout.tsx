"use client";

import { useSession } from "next-auth/react";
import { signOutToLogin } from "@/lib/signOutToLogin";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import { NotificationsProvider } from "../components/NotificationsProvider";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isGateChecking, setIsGateChecking] = useState(true);
  // useSession()'s update() (called whenever we push a fresh
  // identityVerificationStatus after a background verification finishes)
  // briefly flips status back to "loading" while it refetches — even though
  // the user never actually logged out. Blocking on every "loading" status
  // was unmounting the whole page (and everything under it, including
  // Dashboard's own data fetch) for that instant, which looked and behaved
  // like an unwanted page reload. Only the *first* loading state — before
  // we've ever confirmed the user is signed in — should gate the UI.
  const [hasAuthenticatedOnce, setHasAuthenticatedOnce] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      setHasAuthenticatedOnce(true);
    }
  }, [status]);
  const hideBottomNav =
    pathname === "/subscription" ||
    pathname.startsWith("/subscription/") ||
    pathname === "/verification" ||
    pathname === "/community/personalised-appearance" ||
    pathname.startsWith("/community/new-post") ||
    pathname.startsWith("/community/post/");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/?authStep=EMAIL");
      return;
    }

    if (
      status === "authenticated" &&
      ((session as any)?.sessionExpired || !(session as any)?.user?.id)
    ) {
      void signOutToLogin();
      return;
    }

    if (status !== "authenticated") {
      setIsGateChecking(true);
      return;
    }

    setIsGateChecking(false);
  }, [status, session, router]);

  if (!hasAuthenticatedOnce && (status === "loading" || isGateChecking)) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-white font-sf-pro-display">
        <div className="h-10 w-10 border-4 border-[#14C3CF]/20 border-t-[#14C3CF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <NotificationsProvider>
      <div className="flex h-[100dvh] flex-col bg-white text-slate-900 overflow-hidden font-sf-pro-display">
        <main
          className={`flex-1 relative min-h-0 overflow-y-auto no-scrollbar ${hideBottomNav ? "" : "px-4 py-4"}`}
        >
          {children}
        </main>
        {!hideBottomNav && <BottomNav />}
      </div>
    </NotificationsProvider>
  );
}
