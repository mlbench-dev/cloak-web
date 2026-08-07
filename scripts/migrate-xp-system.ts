import { getDb } from "@/lib/mongodb";
import { calculateLevel, checkAchievements, initializeUserAchievements } from "@/lib/achievements";
import { XP_CONFIG } from "@/lib/config";
import type { AnyBulkWriteOperation, Document } from "mongodb";
import type { UserDoc } from "@/models/User";

// One-off backfill for the points -> XP/achievements split.
//
// - xp is backfilled from each user's existing verifiedReports count
//   (xp = verifiedReports * XP_CONFIG.REPORT_APPROVED) rather than reset to
//   0, so no one loses visible progress.
// - level is recomputed from that xp against the new LEVEL_CONFIG
//   thresholds.
// - achievements are recomputed against the new (badge-only) rules —
//   notably FIRST_SIGNAL now requires an approved report, not just a
//   submission.
// - the legacy shared `points` field is dropped.
// - existing VERIFIED reports are flagged xpAwarded so the audit trail
//   matches reality (the PATCH route's PENDING-only guard already prevents
//   re-awarding regardless of this flag).
async function main() {
  const db = await getDb();
  const usersCollection = db.collection("users");
  const reportsCollection = db.collection("reports");

  const users = await usersCollection.find({}).toArray();
  const userOps: AnyBulkWriteOperation<Document>[] = [];

  for (const user of users) {
    const verifiedReports = typeof user.verifiedReports === "number" ? user.verifiedReports : 0;
    const totalReports = typeof user.totalReports === "number" ? user.totalReports : 0;
    const accuracyPercentage = typeof user.accuracyPercentage === "number" ? user.accuracyPercentage : 0;
    const xp = verifiedReports * XP_CONFIG.REPORT_APPROVED;
    const level = calculateLevel(xp).currentLevel;

    const achievements = Array.isArray(user.achievements) && user.achievements.length > 0
      ? user.achievements
      : initializeUserAchievements();

    const { updatedAchievements } = checkAchievements({
      ...user,
      totalReports,
      verifiedReports,
      accuracyPercentage,
      achievements,
    } as UserDoc);

    userOps.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            xp,
            level,
            achievements: updatedAchievements,
            updatedAt: new Date(),
          },
          $unset: { points: "" },
        },
      },
    });
  }

  if (userOps.length > 0) {
    const result = await usersCollection.bulkWrite(userOps);
    console.log(`Backfilled xp/level/achievements for ${result.modifiedCount} user(s).`);
  }

  const reportResult = await reportsCollection.updateMany(
    { status: "VERIFIED", xpAwarded: { $ne: true } },
    { $set: { xpAwarded: true } },
  );
  console.log(`Flagged ${reportResult.modifiedCount} already-approved report(s) as xpAwarded.`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
