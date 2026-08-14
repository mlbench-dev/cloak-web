import { ObjectId, type Db } from "mongodb";
import type {
  NotificationDoc,
  NotificationFilter,
  NotificationType,
} from "@/models/Notification";

export const NOTIFICATIONS_COLLECTION = "notifications";
const PLACEHOLDER_AVATAR = "/images/placeholder_avatar.png";

export function pickAvatarUrl(user: any): string {
  return user?.profileImage || user?.image || PLACEHOLDER_AVATAR;
}

// The shape both the REST list endpoint (GET /api/alerts) and the SSE
// stream (GET /api/alerts/stream) send to the client — kept in one place so
// the two delivery paths can't drift apart.
export type ApiAlertItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  filter: NotificationFilter;
  avatarType: NotificationDoc["avatarType"];
  avatarUrl?: string;
  badgeLabel?: string;
  badgeTone?: NotificationDoc["badgeTone"];
  href?: string;
};

// Where tapping a notification should take you. Report/post types carry
// the relevant id in `data`; the rest link to a fixed, per-user page since
// there's nothing more specific to deep-link to.
function buildAlertHref(doc: any): string | undefined {
  const reportId = doc?.data?.reportId;
  const postId = doc?.data?.postId;

  switch (doc.type) {
    // /reports/[id] resolves the viewer's relationship to the report
    // itself (sent vs received), so the same link works regardless of
    // which side of the report this notification was about.
    case "REPORT_RECEIVED":
    case "REPORT_VERIFIED":
      return typeof reportId === "string" ? `/reports/${reportId}` : undefined;
    case "POST_VOTE":
    case "POST_RAPID_ACTION":
      return typeof postId === "string"
        ? `/cloak-watch/post/${postId}`
        : undefined;
    case "VERIFICATION_RESULT":
      return "/verification";
    case "SUBSCRIPTION_EXPIRING":
    case "SUBSCRIPTION_EXPIRED":
      return "/subscription";
    default:
      return undefined;
  }
}

export function toAlertApiItem(doc: any): ApiAlertItem {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    createdAt: new Date(doc.createdAt).toISOString(),
    filter: doc.filter,
    avatarType: doc.avatarType,
    avatarUrl: doc.avatarUrl,
    badgeLabel: doc.badgeLabel,
    badgeTone: doc.badgeTone,
    href: buildAlertHref(doc),
  };
}

// createIndex is idempotent but still costs a DB round trip — cache the
// promise so this only runs once per server process (mirrors
// ensureCloakWatchIndexes in lib/cloakWatch.ts and ensurePlanIndexes in
// lib/planLimits.ts).
let indexesEnsuredPromise: Promise<void> | null = null;

// IMPORTANT: dedupeKey's uniqueness index must be a SINGLE-FIELD sparse
// index, not compound with userId. MongoDB's sparse rule for a *compound*
// index only excludes a document when ALL of the indexed fields are
// missing — since userId is always present, a {userId, dedupeKey} sparse
// index would still index every notification (treating a missing
// dedupeKey as null for indexing purposes), so any two non-deduped
// notifications for the same user collide on (userId, null). A
// single-field sparse index on dedupeKey alone correctly excludes any
// document missing that field, full stop — and every dedupeKey value
// already embeds enough context (postId, userId, reportId, ...) to be
// globally unique on its own, so dropping userId from the index loses
// nothing.
export function ensureNotificationIndexes(db: Db) {
  if (!indexesEnsuredPromise) {
    const collection = db.collection(NOTIFICATIONS_COLLECTION);
    indexesEnsuredPromise = Promise.all([
      collection.createIndex({ userId: 1, createdAt: -1 }),
      collection.createIndex({ userId: 1, filter: 1, createdAt: -1 }),
      collection.createIndex({ dedupeKey: 1 }, { unique: true, sparse: true }),
      // Drop the old, incorrectly-compound index from before this fix, if
      // it's still there — createIndex above alone won't remove it.
      collection
        .dropIndex("userId_1_dedupeKey_1")
        .catch(() => undefined),
    ])
      .then(() => undefined)
      .catch((err) => {
        // Allow the next request to retry if index creation failed.
        indexesEnsuredPromise = null;
        throw err;
      });
  }
  return indexesEnsuredPromise;
}

type CreateNotificationInput = {
  userId: ObjectId;
  type: NotificationType;
  filter: NotificationFilter;
  title: string;
  description: string;
  avatarType: NotificationDoc["avatarType"];
  avatarUrl?: string;
  badgeLabel?: string;
  badgeTone?: NotificationDoc["badgeTone"];
  data?: Record<string, unknown>;
  dedupeKey?: string;
};

// The Mongo driver serializes `undefined` object values as BSON null by
// default — so naively spreading optional fields onto the doc would store
// e.g. `dedupeKey: null` instead of omitting the key. That matters here:
// the unique sparse index on dedupeKey only excludes documents where the
// field is truly absent, not ones where it's present as null. Stripping
// undefined keys before insert keeps non-deduped notifications genuinely
// field-less so they're correctly excluded from that index.
function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

// If dedupeKey is set, a duplicate fire is a silent no-op (upsert with
// $setOnInsert) rather than a duplicate notification — backed by the unique
// sparse dedupeKey index above. Without dedupeKey, always inserts.
export async function createNotification(
  db: Db,
  input: CreateNotificationInput,
): Promise<void> {
  await ensureNotificationIndexes(db);

  const doc = omitUndefined({
    userId: input.userId,
    type: input.type,
    filter: input.filter,
    title: input.title,
    description: input.description,
    avatarType: input.avatarType,
    avatarUrl: input.avatarUrl,
    badgeLabel: input.badgeLabel,
    badgeTone: input.badgeTone,
    data: input.data,
    dedupeKey: input.dedupeKey,
    createdAt: new Date(),
  }) as unknown as NotificationDoc;

  if (input.dedupeKey) {
    // dedupeKey alone is the uniqueness scope (see the index comment
    // above) — every value already embeds enough context to be globally
    // unique, so no need to also filter on userId here.
    await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
      { dedupeKey: input.dedupeKey },
      { $setOnInsert: doc },
      { upsert: true },
    );
    return;
  }

  await db.collection(NOTIFICATIONS_COLLECTION).insertOne(doc);
}

// The "AI Detection" badge isn't known yet at submission time — it resolves
// async once the AI confidence check completes. See applyAiDetectionBadge
// below, called from lib/reportAiConfidence.ts.
export async function notifyReportReceived(
  db: Db,
  input: {
    targetUserId: ObjectId;
    reporter: any;
    reportId: ObjectId;
    // Only passed by the one-off backfill script, so re-running it against
    // already-backfilled reports is a no-op instead of duplicating.
    dedupeKey?: string;
  },
): Promise<void> {
  await createNotification(db, {
    userId: input.targetUserId,
    type: "REPORT_RECEIVED",
    filter: "Community",
    title: "Match Found",
    description: "You were detected in a community post",
    avatarType: "image",
    avatarUrl: pickAvatarUrl(input.reporter),
    data: { reportId: input.reportId.toString() },
    dedupeKey: input.dedupeKey,
  });
}

// Called from lib/reportAiConfidence.ts once a report's AI confidence score
// resolves. Patches the REPORT_RECEIVED notification created at submission
// time so it picks up the "AI Detection" badge without waiting for a new
// notification — mirrors the >=85 threshold the old synthesized alert used.
export async function applyAiDetectionBadge(
  db: Db,
  reportId: ObjectId,
  confidence: number,
): Promise<void> {
  if (confidence < 85) return;

  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { type: "REPORT_RECEIVED", "data.reportId": reportId.toString() },
    { $set: { badgeLabel: "AI Detection", badgeTone: "cyan" } },
  );
}

export async function notifyPostVote(
  db: Db,
  input: {
    authorId: ObjectId;
    voter: any;
    postId: ObjectId;
    value: 1 | -1;
  },
): Promise<void> {
  const isUpvote = input.value === 1;
  const voterLabel = input.voter?.username
    ? `@${input.voter.username}`
    : "Someone";

  await createNotification(db, {
    userId: input.authorId,
    type: "POST_VOTE",
    filter: "Community",
    title: isUpvote ? "New Upvote" : "New Downvote",
    description: `${voterLabel} ${
      isUpvote ? "upvoted" : "downvoted"
    } your Cloak Watch post`,
    avatarType: "image",
    avatarUrl: pickAvatarUrl(input.voter),
    data: { postId: input.postId.toString() },
  });
}

export async function notifyPostRapidAction(
  db: Db,
  input: {
    authorId: ObjectId;
    postId: ObjectId;
    postImageUrl?: string;
    authorAvatarUrl: string;
  },
): Promise<void> {
  await createNotification(db, {
    userId: input.authorId,
    type: "POST_RAPID_ACTION",
    filter: "Community",
    title: "Your post is trending",
    description: "Your post getting rapid action",
    avatarType: "image",
    avatarUrl: input.postImageUrl || input.authorAvatarUrl,
    badgeLabel: "Trending",
    badgeTone: "green",
    data: { postId: input.postId.toString() },
    dedupeKey: `rapid-action-${input.postId.toString()}`,
  });
}

export async function notifyReportVerified(
  db: Db,
  input: {
    reporterId: ObjectId;
    targetUser: any;
    reportId: ObjectId;
    pointsAwarded: number;
    // Only passed by the one-off backfill script — see notifyReportReceived.
    dedupeKey?: string;
  },
): Promise<void> {
  const targetUsername = String(input.targetUser?.username || "user");

  await createNotification(db, {
    userId: input.reporterId,
    type: "REPORT_VERIFIED",
    filter: "Rewards",
    title: `Report verified for @${targetUsername}`,
    description: `+${input.pointsAwarded} points have been added`,
    avatarType: "image",
    avatarUrl: pickAvatarUrl(input.targetUser),
    data: { reportId: input.reportId.toString() },
    dedupeKey: input.dedupeKey,
  });
}

export async function notifyVerificationResult(
  db: Db,
  input: {
    userId: ObjectId;
    status: "APPROVED" | "REJECTED";
    failureReason?: string | null;
  },
): Promise<void> {
  const isApproved = input.status === "APPROVED";

  await createNotification(db, {
    userId: input.userId,
    type: "VERIFICATION_RESULT",
    filter: "System",
    title: isApproved
      ? "Identity Verified"
      : "Identity Verification Unsuccessful",
    description: isApproved
      ? "Your identity has been verified successfully."
      : input.failureReason ||
        "Your identity verification was not approved. Please try again.",
    avatarType: "info",
  });
}

// checkpointDays identifies *which* reminder this is (e.g. the 3-day-out
// one vs the 1-day-out one) so each fires exactly once — folded into the
// dedupeKey alongside periodKey so the same subscription can still get a
// separate notification at each checkpoint as it approaches expiry.
export async function notifySubscriptionExpiring(
  db: Db,
  input: {
    userId: ObjectId;
    planName: string;
    daysLeft: number;
    checkpointDays: number;
    periodKey: string;
  },
): Promise<void> {
  await createNotification(db, {
    userId: input.userId,
    type: "SUBSCRIPTION_EXPIRING",
    filter: "System",
    title: "Subscription Expiring Soon",
    description: `Your ${input.planName} expires in ${input.daysLeft} day${
      input.daysLeft === 1 ? "" : "s"
    }`,
    avatarType: "crown",
    dedupeKey: `sub-expiring-${input.checkpointDays}d-${input.userId.toString()}-${input.periodKey}`,
  });
}

// Fires once, the first cron pass that finds the billing period has
// actually ended (currentPeriodEnd <= now) with the subscription still
// marked ACTIVE — covers both "declined to renew" (cancelAtPeriodEnd) and
// a failed/missed renewal payment. A successful auto-renewal moves
// currentPeriodEnd forward before this ever matches, so this only fires
// for a genuine lapse.
export async function notifySubscriptionExpired(
  db: Db,
  input: {
    userId: ObjectId;
    planName: string;
    periodKey: string;
  },
): Promise<void> {
  await createNotification(db, {
    userId: input.userId,
    type: "SUBSCRIPTION_EXPIRED",
    filter: "System",
    title: "Subscription Expired",
    description: `Your ${input.planName} has ended. Renew to keep your protection active.`,
    avatarType: "crown",
    dedupeKey: `sub-expired-${input.userId.toString()}-${input.periodKey}`,
  });
}
