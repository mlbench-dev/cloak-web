import { NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkAchievements, calculateLevel } from "@/lib/achievements";
import { XP_CONFIG, PLAN_LIMITS } from "@/lib/config";
import { resolveUserPlan } from "@/lib/planLimits";
import type { AiConfidenceStatus, ReportDoc, UserDoc } from "@/models/User";
import {
  computeAndStoreAiConfidence,
  getEffectiveAiConfidenceStatus,
  refreshVerificationGate,
  shouldAttemptAiConfidence,
} from "@/lib/reportAiConfidence";
import { notifyReportVerified } from "@/lib/notifications";

// See app/api/reports/route.ts for why this matches the AI service's
// 10-minute fetch timeout, and the caveat that your Vercel plan may still
// cap this lower regardless.
export const maxDuration = 600;

type StoredReport = {
  _id?: ObjectId;
  reportedBy: ObjectId;
  targetUserId: ObjectId;
  sourceLink: string;
  notes?: string;
  aiConfidence?: number;
  aiConfidenceSource?: ReportDoc["aiConfidenceSource"];
  aiConfidenceMessage?: string;
  aiConfidenceStatus?: AiConfidenceStatus;
  aiConfidenceAttempts?: number;
  aiConfidenceLastAttemptAt?: Date;
  status?: string;
  xpAwarded?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  platform?: string;
};

type ReportUserProjection = {
  username?: string;
  name?: string;
  image?: string;
  profileImage?: string;
  level?: number;
  identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const report = (await reportsCollection.findOne({
      _id: new ObjectId(reportId),
    })) as StoredReport | null;
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.targetUserId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // A report can only be resolved once. This is the sole guard against
    // duplicate XP allocation: once status leaves "PENDING", this route can
    // never touch the reporter's stats/XP for this report again.
    if (report.status !== "PENDING") {
      return NextResponse.json(
        { error: "Report has already been resolved" },
        { status: 400 },
      );
    }

    const updateData: {
      status: "VERIFIED" | "FALSE_POSITIVE" | "REJECTED";
      updatedAt: Date;
      verifiedAt?: Date;
      verifiedBy?: ObjectId;
      xpAwarded?: boolean;
    } = {
      status,
      updatedAt: new Date(),
    };

    if (status === "VERIFIED") {
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = new ObjectId(session.user.id);
      updateData.xpAwarded = true;
    }

    await reportsCollection.updateOne(
      { _id: new ObjectId(reportId) },
      { $set: updateData },
    );

    const reporterId = report.reportedBy;
    const reporter = (await usersCollection.findOne({
      _id: reporterId,
    })) as UserDoc | null;

    // Reported back to the caller so the approval-result modal can show
    // the actual amount credited (plan multiplier applied), not a hardcoded
    // flat number.
    let pointsAwarded = 0;

    if (reporter) {
      const updatedReporter: UserDoc = {
        ...reporter,
        achievements: Array.isArray(reporter.achievements)
          ? reporter.achievements
          : [],
        xp: reporter.xp || 0,
        level: reporter.level || 0,
        totalReports: reporter.totalReports || 0,
        verifiedReports: reporter.verifiedReports || 0,
        accuracyPercentage: reporter.accuracyPercentage || 0,
      };

      // Only an approved (VERIFIED) report grants XP — false/rejected
      // reports never do. The multiplier used is whatever plan the
      // reporter is on at approval time, not submission time.
      if (status === "VERIFIED") {
        updatedReporter.verifiedReports += 1;
        const reporterPlan = await resolveUserPlan(db, reporterId);
        const multiplier = PLAN_LIMITS[reporterPlan].xpMultiplier;
        pointsAwarded = Math.round(XP_CONFIG.REPORT_APPROVED * multiplier);
        updatedReporter.xp += pointsAwarded;
      }

      if (updatedReporter.totalReports > 0) {
        updatedReporter.accuracyPercentage = Math.round(
          (updatedReporter.verifiedReports / updatedReporter.totalReports) *
            100,
        );
      }

      const levelInfo = calculateLevel(updatedReporter.xp);
      updatedReporter.level = levelInfo.currentLevel;

      const { updatedAchievements } = checkAchievements(updatedReporter);

      await usersCollection.updateOne(
        { _id: reporterId },
        {
          $set: {
            verifiedReports: updatedReporter.verifiedReports,
            accuracyPercentage: updatedReporter.accuracyPercentage,
            xp: updatedReporter.xp,
            level: updatedReporter.level,
            achievements: updatedAchievements,
            updatedAt: new Date(),
          },
        },
      );

      if (status === "VERIFIED") {
        await reportsCollection.updateOne(
          { _id: new ObjectId(reportId) },
          { $set: { xpAwardedAmount: pointsAwarded } },
        );

        const targetUser = await usersCollection.findOne(
          { _id: report.targetUserId },
          { projection: { username: 1, image: 1, profileImage: 1 } },
        );

        await notifyReportVerified(db, {
          reporterId,
          targetUser,
          reportId: new ObjectId(reportId),
          pointsAwarded,
        });
      }
    }

    return NextResponse.json({ success: true, pointsAwarded });
  } catch (error) {
    console.error("Error updating report status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function toReportUser(
  user: {
    _id?: ObjectId;
    username?: string;
    name?: string;
    image?: string;
    profileImage?: string;
    level?: number;
    identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  } | null,
) {
  if (!user) return null;

  return {
    _id: user._id?.toString(),
    username: user.username,
    name: user.name,
    image: user.image,
    profileImage: user.profileImage,
    level: user.level,
    identityVerificationStatus: user.identityVerificationStatus,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reportId = new ObjectId(id);
    const db = await getDb();
    const reportsCollection = db.collection("reports");
    const usersCollection = db.collection("users");

    const report = (await reportsCollection.findOne({
      _id: reportId,
    })) as StoredReport | null;
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (
      report.reportedBy.toString() !== session.user.id &&
      report.targetUserId.toString() !== session.user.id
    ) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const [reportedByUser, targetUser] = await Promise.all([
      usersCollection.findOne(
        { _id: report.reportedBy },
        {
          projection: {
            username: 1,
            name: 1,
            image: 1,
            profileImage: 1,
            level: 1,
            identityVerificationStatus: 1,
          },
        },
      ) as Promise<ReportUserProjection | null>,
      usersCollection.findOne(
        { _id: report.targetUserId },
        {
          projection: {
            username: 1,
            name: 1,
            image: 1,
            profileImage: 1,
            level: 1,
            identityVerificationStatus: 1,
          },
        },
      ) as Promise<ReportUserProjection | null>,
    ]);

    // Cheap re-check (DB read only, no AI call): if this report was
    // waiting on the target user's reference-media verification, see
    // if that's completed since we last looked. Runs on every view.
    const effectiveStatus = await refreshVerificationGate(db, reportId, report);

    // Only kicks off the expensive AI call if the gate is open and
    // we're not already processing / out of retries / cooling down.
    // Boost/Cloak Pro reporters get a shorter cooldown between retries.
    const reporterPlan = await resolveUserPlan(db, report.reportedBy);
    if (shouldAttemptAiConfidence(report, PLAN_LIMITS[reporterPlan].retryCooldownMs)) {
      after(() => computeAndStoreAiConfidence(reportId));
    }

    const viewType =
      report.reportedBy.toString() === session.user.id ? "sent" : "received";

    return NextResponse.json({
      success: true,
      viewType,
      report: {
        _id: report._id?.toString(),
        reportedBy: report.reportedBy.toString(),
        targetUserId: report.targetUserId.toString(),
        sourceLink: report.sourceLink,
        platform: report.platform,
        notes: report.notes,
        status: report.status,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        aiConfidence: report.aiConfidence ?? 0,
        aiConfidenceSource: report.aiConfidenceSource,
        aiConfidenceMessage: report.aiConfidenceMessage,
        aiConfidenceStatus: effectiveStatus,
        user: toReportUser(targetUser),
        reportedByUser: toReportUser(reportedByUser),
      },
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
