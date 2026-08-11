import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { PLAN_DISPLAY_NAME, PLAN_LIMITS } from "@/lib/config";
import {
  assertPayfastProductionReady,
  buildCheckoutFields,
  PAYFAST_PROCESS_URL,
} from "@/lib/payfast";
import { ensureSubscriptionIndexes, upsertPendingSubscription } from "@/lib/subscription";
import type { PlanCode } from "@/models/Subscription";

const SLUG_TO_PLAN: Record<string, PlanCode> = {
  "boost-protection": "BOOST",
  "cloak-pro": "CLOAK_PRO",
};

export async function POST(request: Request) {
  try {
    assertPayfastProductionReady();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const slug = String(body?.plan || "");
    const plan = SLUG_TO_PLAN[slug];

    if (!plan) {
      return NextResponse.json(
        { error: "Invalid or missing plan." },
        { status: 400 },
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (!appUrl) {
      console.error("NEXT_PUBLIC_APP_URL is not configured — cannot build PayFast return/cancel/notify URLs.");
      return NextResponse.json(
        { error: "Server not available, try again later." },
        { status: 502 },
      );
    }

    const db = await getDb();
    await ensureSubscriptionIndexes(db);

    const userId = new ObjectId(session.user.id);
    const user = await db
      .collection("users")
      .findOne({ _id: userId }, { projection: { email: 1 } });

    const amountZar = PLAN_LIMITS[plan].priceZarCents / 100;
    if (amountZar <= 0) {
      console.error(`PLAN_LIMITS.${plan}.priceZarCents is not configured yet.`);
      return NextResponse.json(
        { error: "This plan isn't available for purchase yet." },
        { status: 502 },
      );
    }

    const merchantPaymentId = `sub_${userId.toString()}_${Date.now()}`;

    const fields = buildCheckoutFields({
      merchantPaymentId,
      amountZar,
      // Kept ASCII and free of ! ' ( ) * ~ — see pfEncode's comment in
      // lib/payfast.ts for why those specifically are risky in a signed
      // field.
      itemName: `Cloak ${PLAN_DISPLAY_NAME[plan]} Monthly Subscription`,
      returnUrl: `${appUrl}/subscription/success`,
      cancelUrl: `${appUrl}/subscription/cancelled`,
      notifyUrl: `${appUrl}/api/subscriptions/notify`,
      buyerEmail: user?.email,
      isRecurring: true,
      recurringAmountZar: amountZar,
    });

    await upsertPendingSubscription(db, {
      userId,
      plan,
      merchantPaymentId,
      billingType: "SUBSCRIPTION",
    });

    return NextResponse.json({
      success: true,
      processUrl: PAYFAST_PROCESS_URL,
      fields,
    });
  } catch (error) {
    console.error("Error creating PayFast checkout:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
