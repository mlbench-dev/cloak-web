import { ObjectId } from "mongodb";
import { PlanCode } from "./Subscription";

export type UserRole = "USER" | "VERIFIED_USER";
export type ReportStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "FALSE_POSITIVE";
export type AiConfidenceStatus =
  | "awaiting_verification" // new
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type AchievementCode =
  | "FIRST_SIGNAL"
  | "ACTIVE_WATCHER"
  | "SCOUT"
  | "SENTINEL"
  | "SHARP_EYE"
  | "TRUTH_SEEKER"
  | "ELITE_DETECTOR"
  | "CLOAK_GUARDIAN";

export interface UserDoc {
  _id?: ObjectId;
  email: string;
  emailVerified: Date | null;
  name?: string;
  image?: string;
  username?: string;
  profileImage?: string;
  role: UserRole;
  // Denormalized cache of the user's current subscription plan — mirrors
  // identityVerificationStatus below (cached here, full record lives in a
  // separate collection). Treat undefined as "FREEMIUM" for legacy rows.
  plan: PlanCode;
  isVerified: boolean;
  identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  // XP drives level progression only. Kept separate from achievements, which
  // are badge-only milestones with no bearing on XP/level.
  xp: number;
  level: number;
  totalReports: number;
  verifiedReports: number;
  accuracyPercentage: number;
  achievements: {
    code: AchievementCode;
    unlockedAt: Date | null;
    progress: number;
    target: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OTPDoc {
  _id?: ObjectId;
  email: string;
  code: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IdentityVerificationDoc {
  _id?: ObjectId;
  userId: ObjectId;
  documentType: string;
  documentUrls: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportDoc {
  _id?: ObjectId;
  reportedBy: ObjectId;
  targetUserId: ObjectId;
  sourceLink: string;
  platform: string;
  notes?: string;
  status: ReportStatus;
  aiConfidence: number;
  aiConfidenceSource?: "api" | "fallback";
  aiConfidenceMessage?: string;
  // Queue/retry tracking — added so AI confidence can be computed in the
  // background and retried automatically instead of blocking submission.
  aiConfidenceStatus?: AiConfidenceStatus;
  aiConfidenceAttempts?: number;
  aiConfidenceLastAttemptAt?: Date;
  verifiedBy?: ObjectId;
  verifiedAt?: Date;
  // Free-text reason the target user gave when rejecting the report.
  rejectionReason?: string;
  // Guards against awarding XP more than once for the same report, even if
  // its status is transitioned/re-fetched multiple times.
  xpAwarded?: boolean;
  // The actual amount credited (base XP * reporter's plan multiplier at
  // approval time). Stored so later displays (e.g. the Rewards alert feed)
  // show what was really awarded, not a recomputation against whatever
  // plan the reporter happens to be on now.
  xpAwardedAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecentSearchDoc {
  _id?: ObjectId;
  userId: ObjectId;
  targetUserId: ObjectId;
  targetUser: {
    _id: string;
    username?: string;
    name?: string;
    image?: string;
    profileImage?: string;
    identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  };
  createdAt: Date;
}

// Achievements are badge-only milestones — no point/XP reward is attached.
export interface AchievementDoc {
  _id?: ObjectId;
  code: AchievementCode;
  name: string;
  description: string;
  target: number;
  iconColor: string;
  order: number;
}

export interface LevelConfig {
  level: number;
  xpRequired: number;
}
