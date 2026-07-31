import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      username?: string;
      isVerified?: boolean;
      identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
      documentType?: string | null;
      role?: string;
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
    onboardingStartedAt?: string | Date;
    sessionExpired?: boolean;
    dbRefreshedAt?: number;
  }
}
