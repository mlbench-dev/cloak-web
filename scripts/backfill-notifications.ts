import { getDb } from "@/lib/mongodb";
import { XP_CONFIG } from "@/lib/config";
import { notifyReportReceived, notifyReportVerified } from "@/lib/notifications";

// One-off: seeds notifications for reports that existed before the
// notifications collection did, so existing users' Alerts lists aren't
// empty right after deploy. Safe to re-run — every insert goes through a
// dedupeKey, so already-backfilled reports are a no-op, not a duplicate.
async function main() {
  const db = await getDb();

  const reports = await db
    .collection("reports")
    .aggregate([
      {
        $lookup: {
          from: "users",
          localField: "reportedBy",
          foreignField: "_id",
          as: "reportedByUser",
        },
      },
      { $unwind: "$reportedByUser" },
      {
        $lookup: {
          from: "users",
          localField: "targetUserId",
          foreignField: "_id",
          as: "targetUser",
        },
      },
      { $unwind: "$targetUser" },
    ])
    .toArray();

  let receivedCount = 0;
  let verifiedCount = 0;

  for (const report of reports) {
    await notifyReportReceived(db, {
      targetUserId: report.targetUserId,
      reporter: report.reportedByUser,
      reportId: report._id,
      dedupeKey: `backfill-received-${report._id.toString()}`,
    });
    receivedCount += 1;

    if (report.status === "VERIFIED") {
      const pointsAwarded =
        typeof report.xpAwardedAmount === "number"
          ? report.xpAwardedAmount
          : XP_CONFIG.REPORT_APPROVED;

      await notifyReportVerified(db, {
        reporterId: report.reportedBy,
        targetUser: report.targetUser,
        reportId: report._id,
        pointsAwarded,
        dedupeKey: `backfill-verified-${report._id.toString()}`,
      });
      verifiedCount += 1;
    }
  }

  console.log(
    `Backfilled ${receivedCount} REPORT_RECEIVED and ${verifiedCount} REPORT_VERIFIED notification(s).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
