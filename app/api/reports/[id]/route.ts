import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkAchievements, calculateLevel } from "@/lib/achievements";
import { POINTS_CONFIG } from "@/lib/config";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { status } = await request.json();
    const reportId = id;

    if (!["VERIFIED", "FALSE_POSITIVE", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const db = await getDb();
    const reportsCollection = db.collection("reports");
    const usersCollection = db.collection("users");

    // Find report
    const report = await reportsCollection.findOne({ _id: new ObjectId(reportId) });
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Only target user can update status? Or maybe moderators? For now, only target user can verify their own reports.
    if (report.targetUserId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Update report
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "VERIFIED") {
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = new ObjectId(session.user.id);
    }

    await reportsCollection.updateOne(
      { _id: new ObjectId(reportId) },
      { $set: updateData }
    );

    // Update reporter's stats if status is VERIFIED or FALSE_POSITIVE
    if (status === "VERIFIED" || status === "FALSE_POSITIVE") {
      const reporterId = report.reportedBy;
      const reporter = await usersCollection.findOne({ _id: reporterId });

      if (reporter) {
        let updatedReporter = { ...reporter };

        if (status === "VERIFIED") {
          updatedReporter.verifiedReports += 1;
          updatedReporter.points += POINTS_CONFIG.REPORT_VERIFICATION;
        }

        // Recalculate accuracy
        if (updatedReporter.totalReports > 0) {
          updatedReporter.accuracyPercentage = Math.round(
            (updatedReporter.verifiedReports / updatedReporter.totalReports) * 100
          );
        }

        // Recalculate level
        const levelInfo = calculateLevel(updatedReporter.points);
        updatedReporter.level = levelInfo.currentLevel;

        // Check achievements
        const achievementResult = await checkAchievements(updatedReporter as any);

        // Update in DB
        await usersCollection.updateOne(
          { _id: reporterId },
          {
            $set: {
              verifiedReports: updatedReporter.verifiedReports,
              accuracyPercentage: updatedReporter.accuracyPercentage,
              points: updatedReporter.points,
              level: updatedReporter.level,
              achievements: achievementResult.updatedAchievements,
              updatedAt: new Date(),
            }
          }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating report status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
