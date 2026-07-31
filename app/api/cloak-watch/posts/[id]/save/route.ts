import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  CLOAK_WATCH_POSTS_COLLECTION,
  CLOAK_WATCH_SAVES_COLLECTION,
  ensureCloakWatchIndexes,
  safeObjectId,
} from "@/lib/cloakWatch";

export async function POST(
  _request: Request,
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

    if (!postId || !userId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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

    const savesCollection = db.collection(CLOAK_WATCH_SAVES_COLLECTION);
    const existingSave = await savesCollection.findOne({ postId, userId });

    let isSaved = true;
    let countDelta = 0;

    if (!existingSave) {
      await savesCollection.insertOne({
        postId,
        userId,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      countDelta = 1;
    } else {
      isSaved = !existingSave.active;
      await savesCollection.updateOne(
        { _id: existingSave._id },
        { $set: { active: isSaved, updatedAt: new Date() } },
      );
      countDelta = isSaved ? 1 : -1;
    }

    await db.collection(CLOAK_WATCH_POSTS_COLLECTION).updateOne(
      { _id: postId },
      { $inc: { savesCount: countDelta }, $set: { updatedAt: new Date() } },
    );

    return NextResponse.json({
      success: true,
      isSaved,
      saves: Math.max(0, (post.savesCount || 0) + countDelta),
    });
  } catch (error) {
    console.error("Error saving cloak watch post:", error);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }
}

