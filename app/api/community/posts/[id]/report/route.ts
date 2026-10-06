import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  CLOAK_WATCH_POSTS_COLLECTION,
  CLOAK_WATCH_REPORTS_COLLECTION,
  createReportDocument,
  ensureCloakWatchIndexes,
  normalizeReportReason,
  safeObjectId,
} from "@/lib/cloakWatch";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const postId = safeObjectId(id);
    const userId = safeObjectId(session.user.id);
    const body = await request.json();

    if (!postId || !userId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const reason = normalizeReportReason(String(body?.reason || ""));
    const details = String(body?.details || "").trim();

    if (!reason) {
      return NextResponse.json({ error: "Invalid report reason" }, { status: 400 });
    }
    if (!details) {
      return NextResponse.json(
        { error: "Please provide additional details" },
        { status: 400 },
      );
    }

    const db = await getDb();
    await ensureCloakWatchIndexes(db);

    const post = await db.collection(CLOAK_WATCH_POSTS_COLLECTION).findOne({
      _id: postId,
      isDeleted: { $ne: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const reportsCollection = db.collection(CLOAK_WATCH_REPORTS_COLLECTION);
    const existingReport = await reportsCollection.findOne({ postId, userId });

    if (existingReport) {
      await reportsCollection.updateOne(
        { _id: existingReport._id },
        { $set: { reason, details, updatedAt: new Date() } },
      );
      return NextResponse.json({ success: true, alreadyReported: true });
    }

    await reportsCollection.insertOne(
      createReportDocument({ postId, userId, reason, details }),
    );

    await db.collection(CLOAK_WATCH_POSTS_COLLECTION).updateOne(
      { _id: postId },
      { $inc: { reportsCount: 1 }, $set: { updatedAt: new Date() } },
    );

    return NextResponse.json({ success: true, alreadyReported: false });
  } catch (error) {
    console.error("Error reporting cloak watch post:", error);
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 },
    );
  }
}

