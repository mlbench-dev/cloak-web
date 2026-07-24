import { ObjectId } from "mongodb";

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
  isVerified: boolean;
  identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  points: number;
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

export interface AchievementDoc {
  _id?: ObjectId;
  code: AchievementCode;
  name: string;
  description: string;
  pointsReward: number;
  target: number;
  iconColor: string;
  order: number;
}

export interface LevelConfig {
  level: number;
  pointsRequired: number;
  name: string;
}
