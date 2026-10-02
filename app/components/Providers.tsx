"use client";

import { SessionProvider } from "next-auth/react";
import AppToaster from "./AppToaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      {children}
      <AppToaster />
    </SessionProvider>
  );
}
