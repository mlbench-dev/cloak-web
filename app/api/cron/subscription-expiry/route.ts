import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { PLAN_DISPLAY_NAME } from "@/lib/config";
import {
  notifySubscriptionExpired,
  notifySubscriptionExpiring,
} from "@/lib/notifications";
import type { PlanCode } from "@/models/Subscription";

// Each entry fires its own one-time reminder as a subscription approaches
// expiry. A subscription within 1 day of expiring is also within 3 days of
// expiring, so on a given run it can match more than one of these — that's
// fine, each checkpoint has its own dedupeKey (see notifySubscriptionExpiring),
// so the 3-day reminder that already fired two days ago is just a no-op
// the day the 1-day reminder fires for the first time.
const EXPIRY_CHECKPOINTS_DAYS = [3, 1];

// Triggered daily by Vercel Cron (see vercel.json). Vercel automatically
// sends `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when
// CRON_SECRET is set — comparing against it here is the standard way to
// keep this route from being publicly triggerable.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const now = new Date();
    const checked: Record<string, number> = {};

    for (const checkpointDays of EXPIRY_CHECKPOINTS_DAYS) {
      const windowEnd = new Date(
        now.getTime() + checkpointDays * 24 * 60 * 60 * 1000,
      );

      const expiringSubscriptions = await db
        .collection("subscriptions")
        .find({
          status: "ACTIVE",
          currentPeriodEnd: { $gte: now, $lte: windowEnd },
        })
        .toArray();

      checked[`${checkpointDays}d`] = expiringSubscriptions.length;

      for (const subscription of expiringSubscriptions) {
        const periodEnd = new Date(subscription.currentPeriodEnd);
        const daysLeft = Math.max(
          1,
          Math.ceil(
            (periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          ),
        );
        const planName =
          PLAN_DISPLAY_NAME[subscription.plan as PlanCode] ||
          subscription.plan;

        await notifySubscriptionExpiring(db, {
          userId: subscription.userId,
          planName,
          daysLeft,
          checkpointDays,
          // One notification per billing period per checkpoint — re-running
          // this cron on later days is a no-op via the unique dedupeKey
          // index, not a re-fire.
          periodKey: periodEnd.toISOString().slice(0, 10),
        });
      }
    }

    // Subscriptions whose period has actually ended but are still marked
    // ACTIVE (a successful auto-renewal would have already moved
    // currentPeriodEnd forward, so this only catches a genuine lapse —
    // declined to renew, or a failed renewal payment).
    const expiredSubscriptions = await db
      .collection("subscriptions")
      .find({ status: "ACTIVE", currentPeriodEnd: { $lte: now } })
      .toArray();

    checked.expired = expiredSubscriptions.length;

    for (const subscription of expiredSubscriptions) {
      const planName =
        PLAN_DISPLAY_NAME[subscription.plan as PlanCode] || subscription.plan;

      await notifySubscriptionExpired(db, {
        userId: subscription.userId,
        planName,
        periodKey: new Date(subscription.currentPeriodEnd)
          .toISOString()
          .slice(0, 10),
      });
    }

    return NextResponse.json({ success: true, checked });
  } catch (error) {
    console.error("Error running subscription-expiry cron:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
