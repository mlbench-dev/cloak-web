import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { resolveUserPlan } from "@/lib/planLimits";

// Real subscription status for the current user — plan, billing status,
// and the current period end, so the UI can show something other than the
// hardcoded placeholder dates that used to live in subscription/_lib/plans.ts.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    // Lazily reconciles users.plan back to FREEMIUM if the period has
    // lapsed — same call the enforcement layer uses, so this page never
    // shows a plan that's actually already expired.
    const plan = await resolveUserPlan(db, userId);

    const subscription = await db.collection("subscriptions").findOne(
      { userId },
      {
        projection: {
          status: 1,
          currentPeriodStart: 1,
          currentPeriodEnd: 1,
          cancelAtPeriodEnd: 1,
        },
      },
    );

    return NextResponse.json({
      success: true,
      plan,
      status: subscription?.status || "NONE",
      cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
      currentPeriodStart: subscription?.currentPeriodStart || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
