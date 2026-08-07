"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      {children}
      <Toaster 
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#fff",
            color: "#2D2D2D",
            borderRadius: "16px",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
            padding: "16px 24px",
            border: "1px solid rgba(0,0,0,0.05)",
          },
          success: {
            iconTheme: {
              primary: "#14C3CF",
              secondary: "#fff",
            },
          },
        }}
      />
    </SessionProvider>
  );
}
