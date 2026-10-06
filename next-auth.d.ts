import "next-auth";
import "next-auth/jwt";
import type { PlanCode } from "@/models/Subscription";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      username?: string;
      isVerified?: boolean;
      identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
      documentType?: string | null;
      role?: string;
      // Optimistic UI only (e.g. hiding gated actions) — every actual
      // enforcement decision re-derives the plan from the database.
      plan?: PlanCode;
      sessionExpired?: boolean;
    } & DefaultSession["user"];
    sessionExpired?: boolean;
  }

  interface User {
    id?: string;
    username?: string;
    isVerified?: boolean;
    identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
    documentType?: string | null;
    role?: string;
    plan?: PlanCode;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    isVerified?: boolean;
    identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
    documentType?: string | null;
    role?: string;
    plan?: PlanCode;
    onboardingStartedAt?: string | Date;
    sessionExpired?: boolean;
    dbRefreshedAt?: number;
  }
}
