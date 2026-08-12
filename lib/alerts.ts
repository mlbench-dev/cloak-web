import { ObjectId } from "mongodb";
import { XP_CONFIG } from "@/lib/config";

export type AlertFilter = "Community" | "Rewards" | "System";
export type BadgeTone = "cyan" | "green";
export type AvatarType = "image" | "crown" | "info";

export type ApiAlertItem = {
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

function pickAvatarUrl(user: any): string {
  const PLACEHOLDER_AVATAR = "/images/placeholder_avatar.png";
  return user?.profileImage || user?.image || PLACEHOLDER_AVATAR;
}

// Alerts aren't stored as discrete documents — they're synthesized on read
// from reports/system events. Shared by the list endpoint and the
// unread-count endpoint so both stay in sync with exactly the same set of
// alerts.
export async function getAllAlertsForUser(
  db: any,
  userId: ObjectId,
): Promise<ApiAlertItem[]> {
  const usersCollection = db.collection("users");

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
        report.verifiedAt || report.updatedAt || report.createdAt || Date.now();
      // Falls back to the flat base amount for reports approved before
      // xpAwardedAmount started being recorded.
      const pointsAwarded =
        typeof report.xpAwardedAmount === "number"
          ? report.xpAwardedAmount
          : XP_CONFIG.REPORT_APPROVED;

      return {
        id: `rewards-${String(report._id)}`,
        title: `Report verified for @${targetUsername}`,
        description: `+${pointsAwarded} points have been added`,
        createdAt: new Date(createdAt).toISOString(),
        filter: "Rewards",
        avatarType: "image",
        avatarUrl: pickAvatarUrl(report.targetUser),
      };
    },
  );

  return [...systemAlerts, ...communityAlerts, ...rewardsAlerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
