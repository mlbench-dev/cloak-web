import type { Db, ObjectId } from "mongodb";
import { PLAN_DISPLAY_NAME, PLAN_LIMITS } from "./config";
import { PlanCode } from "@/models/Subscription";

export type LimitKind =
  | "REPORTS_MONTHLY"
  | "SEARCH_DAILY"
  | "SAVED_LOOKUPS"
  | "COMMUNITY_POST";

export type LimitCheckResult =
  | { allowed: true; plan: PlanCode; usage: number; limit: number | null }
  | {
      allowed: false;
      plan: PlanCode;
      usage: number;
      limit: number;
      reason: string;
      upgradeTo: PlanCode[];
    };

// createIndex is idempotent but still costs a round trip — cache the
// promise so this only runs once per server process (mirrors
// ensureCloakWatchIndexes in lib/cloakWatch.ts).
let indexesEnsuredPromise: Promise<void> | null = null;

export function ensurePlanIndexes(db: Db) {
  if (!indexesEnsuredPromise) {
    indexesEnsuredPromise = Promise.all([
      db.collection("reports").createIndex({ reportedBy: 1, createdAt: -1 }),
      db
        .collection("recentSearches")
        .createIndex({ userId: 1, targetUserId: 1 }, { unique: true }),
      db
        .collection("usageCounters")
        .createIndex({ userId: 1, kind: 1, periodKey: 1 }, { unique: true }),
      db
        .collection("usageCounters")
        .createIndex(
          { updatedAt: 1 },
          { expireAfterSeconds: 60 * 60 * 24 * 90 },
        ),
    ])
      .then(() => undefined)
      .catch((err) => {
        indexesEnsuredPromise = null;
        throw err;
      });
  }
  return indexesEnsuredPromise;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function upgradeTargetsFor(plan: PlanCode): PlanCode[] {
  if (plan === "FREEMIUM") return ["CLOAK_PRO"];
  return [];
}

// The nearest paid tier above the given plan, for "upgrade to X" copy.
function nextTierName(plan: PlanCode): string | null {
  const [nearest] = upgradeTargetsFor(plan);
  return nearest ? PLAN_DISPLAY_NAME[nearest] : null;
}

// Resolves a user's current plan. Trusts the users.plan cache for the
// common (Freemium) case — zero extra query. For a paid plan, also checks
// whether the subscription period has lapsed and lazily downgrades if so,
// mirroring refreshVerificationGate's "cheap re-check on read, write-back
// if stale" pattern in lib/reportAiConfidence.ts. This never calls out to
// PayFast — it only reconciles against our own subscriptions collection.
export async function resolveUserPlan(
  db: Db,
  userId: ObjectId,
): Promise<PlanCode> {
  const user = await db
    .collection("users")
    .findOne({ _id: userId }, { projection: { plan: 1 } });
  // Anything not in PLAN_LIMITS (e.g. a retired plan code left in old data)
  // is treated as Freemium rather than breaking every limit lookup.
  const cachedPlan: PlanCode =
    user?.plan && user.plan in PLAN_LIMITS ? (user.plan as PlanCode) : "FREEMIUM";

  if (cachedPlan === "FREEMIUM") return "FREEMIUM";

  const subscription = await db
    .collection("subscriptions")
    .findOne({ userId }, { projection: { status: 1, currentPeriodEnd: 1, cancelAtPeriodEnd: 1 } });

  const isExpired =
    !subscription ||
    (subscription.currentPeriodEnd &&
      new Date(subscription.currentPeriodEnd) < new Date() &&
      (subscription.cancelAtPeriodEnd || subscription.status !== "ACTIVE"));

  if (isExpired) {
    await db
      .collection("users")
      .updateOne({ _id: userId }, { $set: { plan: "FREEMIUM", updatedAt: new Date() } });
    return "FREEMIUM";
  }

  return cachedPlan;
}

export async function checkLimit(
  db: Db,
  params: { userId: ObjectId; plan: PlanCode; kind: LimitKind },
): Promise<LimitCheckResult> {
  const { userId, plan, kind } = params;
  const limits = PLAN_LIMITS[plan];

  if (kind === "REPORTS_MONTHLY") {
    const limit = limits.reportsPerMonth;
    if (limit === null) return { allowed: true, plan, usage: 0, limit: null };

    const usage = await db.collection("reports").countDocuments({
      reportedBy: userId,
      createdAt: { $gte: startOfCurrentMonthUtc() },
    });
    if (usage >= limit) {
      const nextTier = nextTierName(plan);
      return {
        allowed: false,
        plan,
        usage,
        limit,
        reason: nextTier
          ? `You've reached your ${PLAN_DISPLAY_NAME[plan]} limit of ${limit} report${limit === 1 ? "" : "s"} this month. Upgrade to ${nextTier} to submit more reports.`
          : `You've reached your limit of ${limit} report${limit === 1 ? "" : "s"} this month.`,
        upgradeTo: upgradeTargetsFor(plan),
      };
    }
    return { allowed: true, plan, usage, limit };
  }

  if (kind === "SAVED_LOOKUPS") {
    const limit = limits.savedLookupsMax;
    if (limit === null) return { allowed: true, plan, usage: 0, limit: null };

    const usage = await db.collection("recentSearches").countDocuments({ userId });
    if (usage >= limit) {
      const nextTier = nextTierName(plan);
      return {
        allowed: false,
        plan,
        usage,
        limit,
        reason: nextTier
          ? `You've reached your ${PLAN_DISPLAY_NAME[plan]} limit of ${limit} saved lookups. Remove one to save a new person, or upgrade to ${nextTier} for unlimited saved lookups.`
          : `You've reached your limit of ${limit} saved lookups. Remove one to save a new person.`,
        upgradeTo: upgradeTargetsFor(plan),
      };
    }
    return { allowed: true, plan, usage, limit };
  }

  if (kind === "SEARCH_DAILY") {
    const limit = limits.searchesPerDay;
    if (limit === null) return { allowed: true, plan, usage: 0, limit: null };

    const counter = await db
      .collection("usageCounters")
      .findOne({ userId, kind: "SEARCH_DAILY", periodKey: todayUtc() });
    const usage = counter?.count || 0;
    if (usage >= limit) {
      const nextTier = nextTierName(plan);
      return {
        allowed: false,
        plan,
        usage,
        limit,
        reason: nextTier
          ? `You've reached your ${PLAN_DISPLAY_NAME[plan]} limit of ${limit} searches today. Upgrade to ${nextTier} for unlimited searches.`
          : `You've reached your limit of ${limit} searches today.`,
        upgradeTo: upgradeTargetsFor(plan),
      };
    }
    return { allowed: true, plan, usage, limit };
  }

  // COMMUNITY_POST — pure boolean, no counter.
  if (limits.canPostCommunity) return { allowed: true, plan, usage: 0, limit: null };
  {
    const nextTier = nextTierName(plan) || PLAN_DISPLAY_NAME.CLOAK_PRO;
    return {
      allowed: false,
      plan,
      usage: 0,
      limit: 0,
      reason: `Community posting is a ${nextTier} perk. Upgrade to ${nextTier} to post in Cloak Watch.`,
      upgradeTo: upgradeTargetsFor(plan),
    };
  }
}

// The only limit kind that needs an explicit consume call — the other
// three derive usage from collections that get written anyway as part of
// the action being gated (the insert IS the consumption).
export async function consumeLimit(
  db: Db,
  params: { userId: ObjectId; kind: "SEARCH_DAILY" },
): Promise<void> {
  await db.collection("usageCounters").updateOne(
    { userId: params.userId, kind: params.kind, periodKey: todayUtc() },
    {
      $inc: { count: 1 },
      $setOnInsert: { createdAt: new Date() },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

export function getUpsellPayload(
  result: Extract<LimitCheckResult, { allowed: false }>,
) {
  return {
    code: "PLAN_LIMIT_REACHED" as const,
    // Duplicated as `error` too so this drops straight into every existing
    // call site's `data.error` handling (the convention every other route
    // in this codebase already uses) without each of them needing to know
    // about the richer shape below.
    error: result.reason,
    message: result.reason,
    usage: result.usage,
    limit: result.limit,
    plan: result.plan,
    upgradeTo: result.upgradeTo,
  };
}
