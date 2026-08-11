import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  isRequestFromPayfast,
  postBackToValidate,
  verifyItnSignatureFromRawBody,
} from "@/lib/payfast";
import { applyValidatedItn, ensureSubscriptionIndexes } from "@/lib/subscription";
import type { SubscriptionEventDoc } from "@/models/Subscription";

function classifyItnType(fields: Record<string, string>): SubscriptionEventDoc["itnType"] {
  if (fields.subscription_type === "1" || fields.token) {
    // PayFast doesn't send an explicit lifecycle-event field distinguishing
    // "first charge" from "recurring charge" — both look like a normal
    // COMPLETE payment ITN with a token. Treating every token-bearing ITN
    // as "recurring" and relying on applyValidatedItn's upsert-by-token
    // behavior to be idempotent either way is deliberate; revisit if
    // PayFast's actual payload turns out to carry a distinguishing field.
    return "SUBSCRIPTION_RECURRING";
  }
  return "ONCE_OFF";
}

// PayFast's Instant Transaction Notification webhook. Keep this handler
// fast and minimal — PayFast retries on any non-2xx response, and the
// unique index on pfPaymentId (see ensureSubscriptionIndexes) already
// makes retries safe, so no heavy work (achievement recalculation etc.)
// belongs here.
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const {
      valid: signatureValid,
      fields,
      paramStringForValidation,
    } = verifyItnSignatureFromRawBody(rawBody);

    // Matches PayFast's own SDK approach: checks the Referer header's
    // hostname against PayFast's known ITN hosts, not the request's source
    // IP — defense-in-depth only, never blocks processing on its own.
    const sourceIpValid = await isRequestFromPayfast(request.headers.get("referer"));

    // Signature verification and this server-to-server validate call are
    // the real trust anchors.
    const serverValidated = signatureValid
      ? await postBackToValidate(paramStringForValidation)
      : false;

    const db = await getDb();
    await ensureSubscriptionIndexes(db);

    const pfPaymentId = fields.pf_payment_id || "";
    const mPaymentId = fields.m_payment_id || "";

    if (!pfPaymentId || !mPaymentId) {
      console.error("PayFast ITN missing pf_payment_id/m_payment_id", fields);
      // Malformed payload, not a delivery failure — 200 so PayFast doesn't
      // retry something that will never become valid.
      return new NextResponse("OK", { status: 200 });
    }

    const event: SubscriptionEventDoc = {
      userId: null,
      pfPaymentId,
      mPaymentId,
      paymentStatus: fields.payment_status || "UNKNOWN",
      itnType: classifyItnType(fields),
      rawPayload: fields,
      signatureValid,
      sourceIpValid,
      serverValidated,
      processedAt: null,
      createdAt: new Date(),
    };

    let inserted;
    try {
      inserted = await db.collection("subscriptionEvents").insertOne(event);
    } catch (error: any) {
      if (error?.code === 11000) {
        // Duplicate delivery of an ITN we've already recorded — this is
        // the idempotency guard. Don't reapply, just acknowledge.
        return new NextResponse("OK", { status: 200 });
      }
      throw error;
    }

    if (signatureValid && serverValidated) {
      await applyValidatedItn(db, event);
      await db
        .collection("subscriptionEvents")
        .updateOne({ _id: inserted.insertedId }, { $set: { processedAt: new Date() } });
    } else {
      console.error("PayFast ITN failed verification", {
        pfPaymentId,
        signatureValid,
        serverValidated,
      });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing PayFast ITN:", error);
    // Non-2xx makes PayFast retry — appropriate here since this really is
    // an unexpected failure, not a rejected/invalid payload.
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
