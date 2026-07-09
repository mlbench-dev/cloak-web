import { ObjectId } from "mongodb";

export type CloakWatchVoteValue = 1 | -1;

export type CloakWatchReportReason =
  | "Spam or Scams"
  | "Hate Speech"
  | "Harassment"
  | "Misleading Information"
  | "Other";

export interface CloakWatchPostDoc {
  _id?: ObjectId;
  authorId: ObjectId;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  authorVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  authorLevel: number;
  body: string;
  imageUrls: string[];
  upvotesCount: number;
  downvotesCount: number;
  sharesCount: number;
  savesCount: number;
  reportsCount: number;
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloakWatchVoteDoc {
  _id?: ObjectId;
  postId: ObjectId;
  userId: ObjectId;
  value: CloakWatchVoteValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloakWatchSaveDoc {
  _id?: ObjectId;
  postId: ObjectId;
  userId: ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloakWatchReportDoc {
  _id?: ObjectId;
  postId: ObjectId;
  userId: ObjectId;
  reason: CloakWatchReportReason;
  details: string;
  createdAt: Date;
  updatedAt: Date;
}
