import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { calculateLevel, initializeUserAchievements, checkAchievements } from "@/lib/achievements";
import { ACHIEVEMENTS, LEVEL_CONFIG } from "@/lib/config";
import { UserDoc } from "@/models/User";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);
    const usersCollection = db.collection("users");
    const reportsCollection = db.collection("reports");

    // These three don't depend on each other's results, so fetch them
    // concurrently instead of paying for 3 sequential DB round trips.
    const [user, reportStatsRows, recentReports] = await Promise.all([
      usersCollection.findOne({ _id: userId }),
      // Calculate actual stats from reports collection via a single grouped
      // aggregate instead of loading every report document into memory.
      reportsCollection
        .aggregate([
          { $match: { reportedBy: userId } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              verified: {
                $sum: { $cond: [{ $eq: ["$status", "VERIFIED"] }, 1, 0] },
              },
            },
          },
        ])
        .toArray(),
      // Get recent activity (last 5 reports received)
      reportsCollection
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
          { $limit: 5 },
        ])
        .toArray(),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const reportStats = reportStatsRows[0];
    const actualTotalReports = reportStats?.total ?? 0;
    const actualVerifiedReports = reportStats?.verified ?? 0;
    const actualAccuracyPercentage = actualTotalReports > 0
      ? Math.round((actualVerifiedReports / actualTotalReports) * 100)
      : 0;

    // Only write back when the cached stats are actually stale, instead of
    // writing to the DB on every dashboard load.
    if (
      user.totalReports !== actualTotalReports ||
      user.verifiedReports !== actualVerifiedReports ||
      user.accuracyPercentage !== actualAccuracyPercentage
    ) {
      await usersCollection.updateOne(
        { _id: userId },
        {
          $set: {
            totalReports: actualTotalReports,
            verifiedReports: actualVerifiedReports,
            accuracyPercentage: actualAccuracyPercentage,
            updatedAt: new Date(),
          },
        },
      );
      user.totalReports = actualTotalReports;
      user.verifiedReports = actualVerifiedReports;
      user.accuracyPercentage = actualAccuracyPercentage;
    }

    // Ensure user has achievements and progress is up-to-date
    let userAchievements = user.achievements || initializeUserAchievements();
    const userDoc: UserDoc = {
      ...user,
      achievements: userAchievements,
    } as UserDoc;
    const { updatedAchievements } = await checkAchievements(userDoc);
    userAchievements = updatedAchievements;

    // Calculate level info
    const levelInfo = calculateLevel(user.points);
    const currentLevelConfig = LEVEL_CONFIG.find(l => l.level === levelInfo.currentLevel);

    // Enrich achievements with config
    const enrichedAchievements = userAchievements.map((achievement: any) => {
      const config = ACHIEVEMENTS.find(a => a.code === achievement.code);
      return {
        ...achievement,
        config,
      };
    }).sort((a: any, b: any) => a.config.order - b.config.order);

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        name: user.name,
        image: user.image,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        identityVerificationStatus: user.identityVerificationStatus,
        role: user.role,
      },
      stats: {
        level: levelInfo.currentLevel,
        levelName: currentLevelConfig?.name,
        levelProgress: levelInfo.progressPercentage,
        pointsToNextLevel: levelInfo.pointsToNextLevel,
        totalReports: user.totalReports,
        verifiedReports: user.verifiedReports,
        accuracyPercentage: user.accuracyPercentage,
        totalPoints: user.points,
      },
      achievements: enrichedAchievements,
      recentActivity: recentReports,
    });
  } catch (error) {
    console.error("Error getting dashboard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
