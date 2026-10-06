import type { Db, ObjectId } from "mongodb";
import type { PlanCode, SubscriptionEventDoc } from "@/models/Subscription";
import {
  PAYFAST_SUBSCRIPTIONS_API_BASE,
  buildManagementApiRequest,
} from "@/lib/payfast";

export { resolveUserPlan } from "@/lib/planLimits";

// createIndex is idempotent but still costs a round trip — cache the
// promise so this only runs once per server process (mirrors
// ensureCloakWatchIndexes in lib/cloakWatch.ts and ensurePlanIndexes in
// lib/planLimits.ts).
let indexesEnsuredPromise: Promise<void> | null = null;

export function ensureSubscriptionIndexes(db: Db) {
  if (!indexesEnsuredPromise) {
    indexesEnsuredPromise = Promise.all([
      db.collection("subscriptions").createIndex({ userId: 1 }, { unique: true }),
      db
        .collection("subscriptions")
        .createIndex({ payfastToken: 1 }, { sparse: true }),
      db
        .collection("subscriptions")
        .createIndex({ payfastMerchantPaymentId: 1 }, { sparse: true }),
      db
        .collection("subscriptionEvents")
        .createIndex({ pfPaymentId: 1 }, { unique: true }),
      db.collection("subscriptionEvents").createIndex({ userId: 1, createdAt: -1 }),
    ])
      .then(() => undefined)
      .catch((err) => {
        indexesEnsuredPromise = null;
        throw err;
      });
  }
  return indexesEnsuredPromise;
}

// Called right before redirecting the user to PayFast, so the ITN handler
// has something to correlate against even if the user closes the tab
// before return_url. Idempotent per user (one current-state doc, per the
// schema note in models/Subscription.ts).
export async function upsertPendingSubscription(
  db: Db,
  params: {
    userId: ObjectId;
    plan: PlanCode;
    merchantPaymentId: string;
    billingType: "ONCE_OFF" | "SUBSCRIPTION";
  },
): Promise<void> {
  await db.collection("subscriptions").updateOne(
    { userId: params.userId },
    {
      $set: {
        plan: params.plan,
        status: "NONE",
        billingType: params.billingType,
        payfastMerchantPaymentId: params.merchantPaymentId,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
      $setOnInsert: { userId: params.userId, createdAt: new Date() },
    },
    { upsert: true },
  );
}

// Applies an already-signature-verified, already-server-validated ITN
// event: writes subscriptions + users.plan together so the two never
// disagree. Billing period is assumed monthly for every plan — revisit if
// a non-monthly cadence is ever added.
export async function applyValidatedItn(
  db: Db,
  event: SubscriptionEventDoc,
): Promise<void> {
  const subscription = await db
    .collection("subscriptions")
    .findOne({ payfastMerchantPaymentId: event.mPaymentId });

  if (!subscription) {
    console.error(
      `PayFast ITN: no subscription doc found for m_payment_id ${event.mPaymentId}`,
    );
    return;
  }

  const isComplete = event.paymentStatus.toUpperCase() === "COMPLETE";

  if (!isComplete) {
    await db.collection("subscriptions").updateOne(
      { _id: subscription._id },
      { $set: { status: "PAST_DUE", updatedAt: new Date() } },
    );
    return;
  }

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.collection("subscriptions").updateOne(
    { _id: subscription._id },
    {
      $set: {
        status: "ACTIVE",
        payfastPfPaymentId: event.rawPayload.pf_payment_id,
        payfastToken: event.rawPayload.token || subscription.payfastToken,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        lastPaymentAmountZar: Number(event.rawPayload.amount_gross || 0) || undefined,
        lastPaymentAt: new Date(),
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
    },
  );

  await db
    .collection("users")
    .updateOne(
      { _id: subscription.userId },
      { $set: { plan: subscription.plan, updatedAt: new Date() } },
    );
}

// Marks a subscription to lapse at the end of the current billing period —
// never an immediate downgrade, matching the existing (currently
// decorative) copy in CancelSubscriptionBlock: "you can still access the
// subscription till {accessUntilDate}". The actual downgrade happens
// lazily via resolveUserPlan once currentPeriodEnd passes.
export async function cancelSubscription(
  db: Db,
  userId: ObjectId,
): Promise<{ success: true } | { success: false; error: string }> {
  const subscription = await db.collection("subscriptions").findOne({ userId });

  if (!subscription || subscription.status !== "ACTIVE") {
    return { success: false, error: "No active subscription found." };
  }

  if (subscription.payfastToken) {
    try {
      const { headers, query } = buildManagementApiRequest({ method: "PUT" });
      const queryString = new URLSearchParams(query).toString();
      const url =
        `${PAYFAST_SUBSCRIPTIONS_API_BASE}/subscriptions/${subscription.payfastToken}/cancel` +
        (queryString ? `?${queryString}` : "");
      const response = await fetch(url, { method: "PUT", headers });
      if (!response.ok) {
        console.error(
          `PayFast subscription cancel call failed: ${response.status}`,
        );
        return {
          success: false,
          error: "Could not reach PayFast to cancel. Please try again shortly.",
        };
      }
    } catch (error) {
      console.error("Failed to cancel PayFast subscription:", error);
      return {
        success: false,
        error: "Could not reach PayFast to cancel. Please try again shortly.",
      };
    }
  }

  await db.collection("subscriptions").updateOne(
    { _id: subscription._id },
    {
      $set: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

  return { success: true };
}
