import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getAllAlertsForUser } from "@/lib/alerts";

function safeObjectId(value: string) {
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = safeObjectId(session.user.id);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const [user, allAlerts] = await Promise.all([
      db
        .collection("users")
        .findOne(
          { _id: userId },
          { projection: { lastAlertsViewedAt: 1 } },
        ),
      getAllAlertsForUser(db, userId),
    ]);

    const lastViewedAt = user?.lastAlertsViewedAt
      ? new Date(user.lastAlertsViewedAt).getTime()
      : 0;

    const count = allAlerts.filter(
      (alert) => new Date(alert.createdAt).getTime() > lastViewedAt,
    ).length;

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Error computing unread alerts count:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
