import { NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ReportDoc, RecentSearchDoc, UserDoc } from "@/models/User";
import {
  computeAndStoreAiConfidence,
  detectPlatform,
  refreshVerificationGate,
  shouldAttemptAiConfidence,
} from "@/lib/reportAiConfidence";
import { checkAchievements, initializeUserAchievements } from "@/lib/achievements";
import {
  checkLimit,
  consumeLimit,
  ensurePlanIndexes,
  getUpsellPayload,
  resolveUserPlan,
} from "@/lib/planLimits";
import { PLAN_LIMITS } from "@/lib/config";
import type { PlanCode } from "@/models/Subscription";
import { notifyReportReceived } from "@/lib/notifications";

// The AI verification call (kicked off via after() below, both here and in
// GET) can now take up to 10 minutes — the function instance has to stay
// alive that whole time for it to actually finish, or Vercel kills it
// mid-flight and the report is left stuck "processing" until the next
// retry window. NOTE: this is capped by your Vercel plan regardless of what
// we set here — Hobby is fixed at 10s no matter what, Pro tops out at 300s
// on classic serverless functions (up to 800s only with Fluid Compute
// enabled). If you're not on Fluid Compute, 10 minutes will still get cut
// short in production even with this set.
export const maxDuration = 600;

function buildRecentSearchDoc(
  sessionUserId: string,
  targetUser: any,
): RecentSearchDoc {
  return {
    userId: new ObjectId(sessionUserId),
    targetUserId: targetUser._id,
    targetUser: {
      _id: targetUser._id.toString(),
      username: targetUser.username,
      name: targetUser.name,
      image: targetUser.image,
      profileImage: targetUser.profileImage,
      identityVerificationStatus: targetUser.identityVerificationStatus,
    },
    createdAt: new Date(),
  };
}

async function upsertRecentSearch(
  db: Awaited<ReturnType<typeof getDb>>,
  sessionUserId: string,
  targetUser: any,
) {
  const recentSearch = buildRecentSearchDoc(sessionUserId, targetUser);
  const recentSearches = db.collection("recentSearches");
  const existingSearch = await recentSearches.findOne({
    userId: new ObjectId(sessionUserId),
    targetUserId: targetUser._id,
  });

  if (!existingSearch) {
    await recentSearches.insertOne(recentSearch);
    return;
  }

  await recentSearches.updateOne(
    { _id: existingSearch._id },
    {
      $set: {
        createdAt: new Date(),
        targetUser: recentSearch.targetUser,
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { targetUserId, sourceLink, platform: providedPlatform, notes } =
      body;

    if (!targetUserId || !sourceLink) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // A user can't report themselves (RPT-002).
    if (String(targetUserId) === session.user.id) {
      return NextResponse.json(
        { error: "You can't report yourself." },
        { status: 400 },
      );
    }

    const db = await getDb();
    await ensurePlanIndexes(db);
    const usersCollection = db.collection("users");

    const targetUser = await usersCollection.findOne({
      _id: new ObjectId(targetUserId),
    });
    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 },
      );
    }

    const reporterId = new ObjectId(session.user.id);

    // Block an exact duplicate: the same reporter re-filing the same link
    // against the same user while a previous report is still open or already
    // upheld (RPT-002). A link that was dismissed (REJECTED/FALSE_POSITIVE)
    // can be reported again.
    const duplicate = await db.collection("reports").findOne({
      reportedBy: reporterId,
      targetUserId: new ObjectId(targetUserId),
      sourceLink,
      status: { $in: ["PENDING", "VERIFIED"] },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "You've already reported this link for this user." },
        { status: 409 },
      );
    }

    const reporterPlan = await resolveUserPlan(db, reporterId);
    const reportsCheck = await checkLimit(db, {
      userId: reporterId,
      plan: reporterPlan,
      kind: "REPORTS_MONTHLY",
    });
    if (!reportsCheck.allowed) {
      return NextResponse.json(getUpsellPayload(reportsCheck), { status: 403 });
    }

    const platform = providedPlatform || detectPlatform(sourceLink);

    const report: ReportDoc = {
      reportedBy: new ObjectId(session.user.id),
      targetUserId: new ObjectId(targetUserId),
      sourceLink,
      platform,
      notes,
      status: "PENDING",
      aiConfidence: 0,
      aiConfidenceStatus: "pending",
      aiConfidenceAttempts: 0,
      aiConfidenceMessage:
        "We're checking this report now — check back in a moment.",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("reports").insertOne(report);
    const reportId = result.insertedId;

    const reporter = (await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(session.user.id) },
      {
        $inc: { totalReports: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" },
    )) as UserDoc | null;

    // Submission-count achievements (e.g. First Signal) can unlock right
    // here — don't wait for the report to be approved/rejected.
    if (reporter) {
      const achievements =
        Array.isArray(reporter.achievements) && reporter.achievements.length > 0
          ? reporter.achievements
          : initializeUserAchievements();

      const { updatedAchievements } = checkAchievements({
        ...reporter,
        achievements,
        totalReports: reporter.totalReports || 0,
        verifiedReports: reporter.verifiedReports || 0,
        accuracyPercentage: reporter.accuracyPercentage || 0,
      } as UserDoc);

      await usersCollection.updateOne(
        { _id: new ObjectId(session.user.id) },
        { $set: { achievements: updatedAchievements } },
      );
    }

    await upsertRecentSearch(db, session.user.id, targetUser);

    await notifyReportReceived(db, {
      targetUserId: new ObjectId(targetUserId),
      reporter: reporter || (await usersCollection.findOne({ _id: reporterId })),
      reportId,
    });

    after(() => computeAndStoreAiConfidence(reportId));

    return NextResponse.json({ success: true, reportId });
  } catch (error) {
    console.error("Error submitting report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const targetUserId = String(body?.targetUserId || "").trim();

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Missing target user" },
        { status: 400 },
      );
    }

    const db = await getDb();
    await ensurePlanIndexes(db);
    const targetUser = await db.collection("users").findOne({
      _id: new ObjectId(targetUserId),
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 },
      );
    }

    const searcherId = new ObjectId(session.user.id);
    const alreadySaved = await db.collection("recentSearches").findOne(
      { userId: searcherId, targetUserId: targetUser._id },
      { projection: { _id: 1 } },
    );

    // Re-selecting an already-saved contact doesn't burn a daily search
    // credit or count against the saved-lookups cap — only a genuinely new
    // lookup does.
    if (!alreadySaved) {
      const plan = await resolveUserPlan(db, searcherId);

      const savedCheck = await checkLimit(db, {
        userId: searcherId,
        plan,
        kind: "SAVED_LOOKUPS",
      });
      if (!savedCheck.allowed) {
        return NextResponse.json(getUpsellPayload(savedCheck), { status: 403 });
      }

      const searchCheck = await checkLimit(db, {
        userId: searcherId,
        plan,
        kind: "SEARCH_DAILY",
      });
      if (!searchCheck.allowed) {
        return NextResponse.json(getUpsellPayload(searchCheck), { status: 403 });
      }

      await consumeLimit(db, { userId: searcherId, kind: "SEARCH_DAILY" });
    }

    await upsertRecentSearch(db, session.user.id, targetUser);

    const savedSearch = await db.collection("recentSearches").findOne({
      userId: new ObjectId(session.user.id),
      targetUserId: targetUser._id,
    });

    return NextResponse.json({
      success: true,
      search: savedSearch,
    });
  } catch (error) {
    console.error("Error saving recent search:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const userId = new ObjectId(session.user.id);

    const db = await getDb();

    if (type === "recent-searches") {
      const searches = await db
        .collection("recentSearches")
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      // The stored `targetUser` is a snapshot taken when the search was
      // saved — it stays truthy even after the target account is deleted,
      // so its presence alone doesn't prove the user still exists. Always
      // re-verify against the live users collection instead of only doing
      // so when the snapshot happens to be missing.
      const targetUserIds = searches
        .map((search) => search.targetUserId)
        .filter((id): id is ObjectId => Boolean(id));

      const liveTargetUsers = await db
        .collection("users")
        .find(
          { _id: { $in: targetUserIds } },
          {
            projection: {
              username: 1,
              name: 1,
              image: 1,
              profileImage: 1,
              identityVerificationStatus: 1,
            },
          },
        )
        .toArray();
      const liveTargetUserById = new Map(
        liveTargetUsers.map((user) => [user._id.toString(), user]),
      );

      const staleSearchIds: ObjectId[] = [];
      const validSearches = searches.filter((search) => {
        const liveUser = search.targetUserId
          ? liveTargetUserById.get(search.targetUserId.toString())
          : undefined;

        if (!liveUser) {
          staleSearchIds.push(search._id);
          return false;
        }

        // Refresh the snapshot so a stale username/avatar doesn't linger.
        search.targetUser = {
          _id: liveUser._id.toString(),
          username: liveUser.username,
          name: liveUser.name,
          image: liveUser.image,
          profileImage: liveUser.profileImage,
          identityVerificationStatus: liveUser.identityVerificationStatus,
        };
        return true;
      });

      if (staleSearchIds.length > 0) {
        // Lazily clean up references to users who no longer exist (e.g.
        // legacy data from before account deletion started purging these)
        // so they don't need to be re-checked on every future load.
        await db
          .collection("recentSearches")
          .deleteMany({ _id: { $in: staleSearchIds } });
      }

      return NextResponse.json({
        success: true,
        searches: validSearches,
      });
    }

    const filter: {
      reportedBy?: ObjectId;
      targetUserId?: ObjectId;
      status?: string;
    } = {};
    if (type === "sent") {
      filter.reportedBy = userId;
    } else if (type === "received") {
      filter.targetUserId = userId;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    // Only the "other party" needs a lookup: for "sent" reports that's the
    // target user, for "received" reports that's the reporter. A lookup on
    // the caller's own user document would just be redundant since the
    // caller already has that data client-side.
    const reports = await db
      .collection("reports")
      .aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "users",
            localField: type === "sent" ? "targetUserId" : "reportedBy",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    // Batched so the retry-cooldown lookup below doesn't cost one query
    // per report — Cloak Pro reporters get a shorter cooldown
    // between automatic retries (see lib/config.ts PLAN_LIMITS).
    const reporterIds = Array.from(
      new Set(reports.map((report) => report.reportedBy.toString())),
    ).map((id) => new ObjectId(id));
    const reporterPlans = reporterIds.length
      ? await db
          .collection("users")
          .find({ _id: { $in: reporterIds } }, { projection: { plan: 1 } })
          .toArray()
      : [];
    const planByReporterId = new Map(
      reporterPlans.map((u) => [u._id.toString(), (u.plan as PlanCode) || "FREEMIUM"]),
    );

    // Same lazy retry as the single-report view (GET /api/reports/[id]),
    // just fanned out across the whole list — the list is what people
    // actually check regularly ("My Reports"), so gating retries on someone
    // drilling into one specific report's detail page left failed/pending
    // ones stuck far more often than it should. Cheap gate re-checks run
    // for every report in view, concurrently; the expensive AI call only
    // kicks off for ones that are actually due (not already processing,
    // not cooling down, not out of retries).
    await Promise.all(
      reports.map(async (report) => {
        report.aiConfidenceStatus = await refreshVerificationGate(
          db,
          report._id,
          report as any,
        );
        const reporterPlan = planByReporterId.get(report.reportedBy.toString()) || "FREEMIUM";
        if (shouldAttemptAiConfidence(report as any, PLAN_LIMITS[reporterPlan].retryCooldownMs)) {
          after(() => computeAndStoreAiConfidence(report._id));
        }
      }),
    );

    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchId = searchParams.get("searchId");

    if (!searchId) {
      return NextResponse.json({ error: "Missing searchId" }, { status: 400 });
    }

    const db = await getDb();
    await db.collection("recentSearches").deleteOne({
      _id: new ObjectId(searchId),
      userId: new ObjectId(session.user.id),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recent search:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}