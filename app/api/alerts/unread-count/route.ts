import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  ensureNotificationIndexes,
  NOTIFICATIONS_COLLECTION,
} from "@/lib/notifications";

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
    await ensureNotificationIndexes(db);

    const user = await db
      .collection("users")
      .findOne({ _id: userId }, { projection: { lastAlertsViewedAt: 1 } });

    const lastViewedAt = user?.lastAlertsViewedAt
      ? new Date(user.lastAlertsViewedAt)
      : new Date(0);

    const count = await db.collection(NOTIFICATIONS_COLLECTION).countDocuments({
      userId,
      createdAt: { $gt: lastViewedAt },
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Error computing unread alerts count:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
