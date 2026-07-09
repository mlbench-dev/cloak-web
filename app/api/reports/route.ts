import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ReportDoc, RecentSearchDoc } from "@/models/User";

// Helper function to detect platform from link
function detectPlatform(link: string): string {
  const lowerLink = link.toLowerCase();
  if (lowerLink.includes("tiktok.com")) return "tiktok";
  if (lowerLink.includes("instagram.com")) return "instagram";
  if (lowerLink.includes("facebook.com") || lowerLink.includes("fb.com"))
    return "facebook";
  if (lowerLink.includes("twitter.com") || lowerLink.includes("x.com"))
    return "twitter";
  return "other";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      targetUserId,
      sourceLink,
      platform: providedPlatform,
      notes,
    } = body;

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

    // Generate fake AI confidence for now (70-95%)
    const aiConfidence = Math.floor(Math.random() * 26) + 70;

    const report: ReportDoc = {
      reportedBy: new ObjectId(session.user.id),
      targetUserId: new ObjectId(targetUserId),
      sourceLink,
      platform,
      notes,
      status: "PENDING",
      aiConfidence,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("reports").insertOne(report);

    // Update submitter's total reports
    await usersCollection.updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $inc: { totalReports: 1 },
        $set: { updatedAt: new Date() },
      },
    );

    // Also add to recent searches
    const recentSearch = {
      userId: new ObjectId(session.user.id),
      targetUserId: new ObjectId(targetUserId),
      targetUser: {
        _id: targetUser._id.toString(),
        username: targetUser.username,
        name: targetUser.name,
        image: targetUser.image,
        profileImage: targetUser.profileImage,
        identityVerificationStatus: targetUser.identityVerificationStatus,
      },
      createdAt: new Date(),
    } satisfies RecentSearchDoc;
    // Check if this search already exists for the user
    const existingSearch = await db.collection("recentSearches").findOne({
      userId: new ObjectId(session.user.id),
      targetUserId: new ObjectId(targetUserId),
    });
    if (!existingSearch) {
      await db.collection("recentSearches").insertOne(recentSearch);
    } else {
      // Update the timestamp
      await db
        .collection("recentSearches")
        .updateOne(
          { _id: existingSearch._id },
          { $set: { createdAt: new Date() } },
        );
    }

    return NextResponse.json({ success: true, reportId: result.insertedId });
  } catch (error) {
    console.error("Error submitting report:", error);
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
    const type = searchParams.get("type"); // "sent" | "received" | "recent-searches"
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

      // For each search, if targetUser is missing, look it up
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

    let filter: any = {};
    if (type === "sent") {
      filter.reportedBy = userId;
    } else if (type === "received") {
      filter.targetUserId = userId;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Add status filter if provided
    if (status && status !== "all") {
      filter.status = status;
    }

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
        {
          $lookup: {
            from: "users",
            localField: "reportedBy",
            foreignField: "_id",
            as: "reportedByUser",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "targetUserId",
            foreignField: "_id",
            as: "targetUser",
          },
        },
        {
          $addFields: {
            reportedByUser: { $arrayElemAt: ["$reportedByUser", 0] },
            targetUser: { $arrayElemAt: ["$targetUser", 0] },
          },
        },
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
