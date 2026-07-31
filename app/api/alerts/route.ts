import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { POINTS_CONFIG } from "@/lib/config";

type AlertFilter = "Community" | "Rewards" | "System";
type BadgeTone = "cyan" | "green";
type AvatarType = "image" | "crown" | "info";

type ApiAlertItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  filter: AlertFilter;
  avatarType: AvatarType;
  avatarUrl?: string;
  badgeLabel?: string;
  badgeTone?: BadgeTone;
};

function safeObjectId(value: string) {
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

function pickAvatarUrl(user: any): string {
  const PLACEHOLDER_AVATAR = "/images/placeholder_avatar.png";

  return user?.profileImage || user?.image || PLACEHOLDER_AVATAR;
}

function normalizeFilter(value: string | null) {
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
    const usersCollection = db.collection("users");

    // None of these three depend on each other's results — fetch them
    // concurrently instead of one round trip at a time.
    const [user, receivedReports, verifiedSentReports] = await Promise.all([
      usersCollection.findOne(
        { _id: userId },
        { projection: { role: 1, username: 1, image: 1, profileImage: 1 } },
      ),
      db
        .collection("reports")
        .aggregate([
          { $match: { targetUserId: userId } },
          {
            $lookup: {
              from: "users",
              localField: "reportedBy",
              foreignField: "_id",
              as: "reportedByUser",
            },
          },
          { $unwind: "$reportedByUser" },
          { $sort: { createdAt: -1 } },
          { $limit: 25 },
        ])
        .toArray(),
      db
        .collection("reports")
        .aggregate([
          { $match: { reportedBy: userId, status: "VERIFIED" } },
          {
            $lookup: {
              from: "users",
              localField: "targetUserId",
              foreignField: "_id",
              as: "targetUser",
            },
          },
          { $unwind: "$targetUser" },
          { $sort: { verifiedAt: -1, updatedAt: -1, createdAt: -1 } },
          { $limit: 25 },
        ])
        .toArray(),
    ]);

    const now = Date.now();
    const systemAlerts: ApiAlertItem[] = [];

    systemAlerts.push({
      id: "system-privacy-update",
      title: "Privacy Update",
      description: "We updated our community guidelines.",
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      filter: "System",
      avatarType: "info",
    });

    if (user?.role === "VERIFIED_USER") {
      systemAlerts.push({
        id: "system-subscription-expiring",
        title: "Subscription Expiring Soon",
        description: "Your Cloak Pro expires in 3 days",
        createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
        filter: "System",
        avatarType: "crown",
      });
    }

    const communityAlerts: ApiAlertItem[] = receivedReports.map(
      (report: any) => {
        const aiConfidence = Number(report.aiConfidence || 0);
        const showBadge = aiConfidence >= 85;

        return {
          id: `community-${String(report._id)}`,
          title: "Match Found",
          description: "You were detected in a community post",
          createdAt: new Date(
            report.createdAt || report.updatedAt || Date.now(),
          ).toISOString(),
          filter: "Community",
          avatarType: "image",
          avatarUrl: pickAvatarUrl(report.reportedByUser),
          badgeLabel: showBadge ? "AI Detection" : undefined,
          badgeTone: showBadge ? "cyan" : undefined,
        };
      },
    );

    const rewardsAlerts: ApiAlertItem[] = verifiedSentReports.map(
      (report: any) => {
        const targetUsername = String(report.targetUser?.username || "user");
        const createdAt =
          report.verifiedAt ||
          report.updatedAt ||
          report.createdAt ||
          Date.now();

        return {
          id: `rewards-${String(report._id)}`,
          title: `Report verified for @${targetUsername}`,
          description: `+${POINTS_CONFIG.REPORT_VERIFICATION} points have been added`,
          createdAt: new Date(createdAt).toISOString(),
          filter: "Rewards",
          avatarType: "image",
          avatarUrl: pickAvatarUrl(report.targetUser),
        };
      },
    );

    const merged = [...systemAlerts, ...communityAlerts, ...rewardsAlerts]
      .filter((item) => {
        if (filterParam === "All") return true;
        return item.filter === filterParam;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
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
