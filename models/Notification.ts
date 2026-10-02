import { ObjectId } from "mongodb";

export type NotificationType =
  | "REPORT_RECEIVED" // someone filed a report against you
  | "POST_VOTE" // your community post got up/downvoted
  | "POST_RAPID_ACTION" // your post crossed 2 upvotes (fires once)
  | "REPORT_VERIFIED" // a report you filed got verified -> XP
  | "SUBSCRIPTION_EXPIRING" // plan expires within N days (multiple checkpoints)
  | "SUBSCRIPTION_EXPIRED" // plan's billing period has actually ended
  | "VERIFICATION_RESULT"; // identity verification approved/rejected

export type NotificationFilter = "Community" | "Rewards" | "System";
export type NotificationAvatarType = "image" | "crown" | "info";
export type NotificationBadgeTone = "cyan" | "green";

export interface NotificationDoc {
  _id?: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  filter: NotificationFilter;
  title: string;
  description: string;
  avatarType: NotificationAvatarType;
  avatarUrl?: string;
  badgeLabel?: string;
  badgeTone?: NotificationBadgeTone;
  // reportId/postId/actorId etc — kept loose for future deep-linking without
  // another schema migration.
  data?: Record<string, unknown>;
  // Set only for events that must fire at most once (rapid-action milestone,
  // one cron pass per billing period). Backs a unique sparse index so a
  // duplicate insert is a no-op instead of a duplicate notification.
  dedupeKey?: string;
  createdAt: Date;
}
