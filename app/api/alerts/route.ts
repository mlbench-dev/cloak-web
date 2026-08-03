import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getAllAlertsForUser, type AlertFilter } from "@/lib/alerts";

function safeObjectId(value: string) {
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

function normalizeFilter(value: string | null): AlertFilter | "All" {
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
    const allAlerts = await getAllAlertsForUser(db, userId);

    const merged = allAlerts
      .filter((item) => filterParam === "All" || item.filter === filterParam)
      .slice(0, 50);

    return NextResponse.json({ success: true, alerts: merged });
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
