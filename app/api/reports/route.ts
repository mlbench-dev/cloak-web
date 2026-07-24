import { NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ReportDoc, RecentSearchDoc } from "@/models/User";
import {
  computeAndStoreAiConfidence,
  detectPlatform,
} from "@/lib/reportAiConfidence";

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

    const db = await getDb();
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

    await usersCollection.updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $inc: { totalReports: 1 },
        $set: { updatedAt: new Date() },
      },
    );

    await upsertRecentSearch(db, session.user.id, targetUser);

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
    const targetUser = await db.collection("users").findOne({
      _id: new ObjectId(targetUserId),
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 },
      );
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

      const enrichedSearches = await Promise.all(
        searches.map(async (search) => {
          if (!search.targetUser) {
            const targetUser = await db
              .collection("users")
              .findOne({ _id: search.targetUserId });
            if (targetUser) {
              search.targetUser = {
                _id: targetUser._id.toString(),
                username: targetUser.username,
                name: targetUser.name,
                image: targetUser.image,
                profileImage: targetUser.profileImage,
                identityVerificationStatus:
                  targetUser.identityVerificationStatus,
              };
            }
          }
          return search;
        }),
      );

      return NextResponse.json({
        success: true,
        searches: enrichedSearches.filter((s) => s.targetUser),
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