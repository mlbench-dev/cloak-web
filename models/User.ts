import { ObjectId } from "mongodb";

export type UserRole = "USER" | "VERIFIED_USER";
export type ReportStatus = "PENDING" | "VERIFIED" | "REJECTED" | "FALSE_POSITIVE";
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
  points: number; // User's total points
  level: number; // Current level (starts at 1)
  totalReports: number; // Total reports submitted by this user
  verifiedReports: number; // Number of reports that were verified/approved
  accuracyPercentage: number; // (verifiedReports / totalReports) * 100
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
  reportedBy: ObjectId; // User who submitted the report
  targetUserId: ObjectId; // User being reported
  sourceLink: string;
  platform: string; // "tiktok" | "instagram" | "facebook" | "twitter" | "other"
  notes?: string;
  status: ReportStatus;
  aiConfidence: number; // AI confidence percentage (0-100)
  verifiedBy?: ObjectId; // User who verified the report
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
