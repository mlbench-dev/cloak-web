"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
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
  const hideBottomNav =
    pathname === "/subscription" ||
    pathname.startsWith("/subscription/") ||
    pathname === "/cloak-watch/personalised-appearance" ||
    pathname.startsWith("/cloak-watch/new-post") ||
    pathname.startsWith("/cloak-watch/post/");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }

    if (
      status === "authenticated" &&
      ((session as any)?.sessionExpired || !(session as any)?.user?.id)
    ) {
      void signOut({ callbackUrl: "/?authStep=EMAIL" });
    }
  }, [status, session, router]);

  if (status === "loading") {
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
