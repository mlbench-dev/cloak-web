import * as Sentry from "@sentry/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MobileOnly from "./components/MobileOnly";
import { Providers } from "./components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  return {
    title: "CLOAK",
    description: "Your Data is Protected",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "CLOAK",
    },
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0D9488",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full bg-[#00BCD4]">
        <Providers>
          <MobileOnly>
            <div className="app-mobile-screen mx-auto w-full max-w-[430px]">{children}</div>
          </MobileOnly>
        </Providers>
      </body>
    </html>
  );
}