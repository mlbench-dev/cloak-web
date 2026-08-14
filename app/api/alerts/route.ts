import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  ensureNotificationIndexes,
  NOTIFICATIONS_COLLECTION,
  toAlertApiItem,
} from "@/lib/notifications";
import type { NotificationFilter } from "@/models/Notification";

function safeObjectId(value: string) {
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

function normalizeFilter(value: string | null): NotificationFilter | "All" {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "community") return "Community";
  if (normalized === "rewards") return "Rewards";
  if (normalized === "system") return "System";
  return "All";
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = safeObjectId(session.user.id);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterParam = normalizeFilter(searchParams.get("filter"));

    const db = await getDb();
    await ensureNotificationIndexes(db);

    const query: { userId: ObjectId; filter?: NotificationFilter } = {
      userId,
    };
    if (filterParam !== "All") {
      query.filter = filterParam;
    }

    const notifications = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const alerts = notifications.map(toAlertApiItem);

    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Marks alerts as viewed so the unread badge (see
// /api/alerts/unread-count) clears next time it's checked.
export async function POST() {
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
    await db
      .collection("users")
      .updateOne({ _id: userId }, { $set: { lastAlertsViewedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking alerts as viewed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
