import { ObjectId } from "mongodb";

export type PlanCode = "FREEMIUM" | "CLOAK_PRO";

export type SubscriptionStatus = "NONE" | "ACTIVE" | "CANCELLED" | "PAST_DUE";

// Source of truth for a user's billing state. One current-state doc per
// user (unique index on userId) — unlike identityVerifications, billing
// state is inherently "the current record," not a history of attempts.
export interface SubscriptionDoc {
  _id?: ObjectId;
  userId: ObjectId;
  plan: PlanCode;
  status: SubscriptionStatus;
  billingType?: "ONCE_OFF" | "SUBSCRIPTION";
  payfastToken?: string;
  payfastMerchantPaymentId?: string;
  payfastPfPaymentId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  lastPaymentAmountZar?: number;
  lastPaymentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Audit log + idempotency ledger for PayFast ITN callbacks. A unique index
// on pfPaymentId is the actual duplicate-delivery guard — PayFast retries
// ITN delivery on any non-2xx response, and a DB-level unique constraint
// closes the race window a read-then-write boolean check can't.
export interface SubscriptionEventDoc {
  _id?: ObjectId;
  userId: ObjectId | null;
  pfPaymentId: string;
  mPaymentId: string;
  paymentStatus: string;
  itnType:
    | "ONCE_OFF"
    | "SUBSCRIPTION_INITIAL"
    | "SUBSCRIPTION_RECURRING"
    | "SUBSCRIPTION_CANCELLED"
    | "SUBSCRIPTION_FAILED"
    | "UNKNOWN";
  rawPayload: Record<string, string>;
  signatureValid: boolean;
  sourceIpValid: boolean;
  serverValidated: boolean;
  processedAt: Date | null;
  createdAt: Date;
}

// Rolling-window counter for limits that can't be derived from an existing
// collection (see lib/planLimits.ts for why only the daily search cap needs
// one). periodKey folds the window into the document key itself, so an
// atomic upsert answers "is this a new period?" in one round trip.
export interface UsageCounterDoc {
  _id?: ObjectId;
  userId: ObjectId;
  kind: "SEARCH_DAILY";
  periodKey: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}
