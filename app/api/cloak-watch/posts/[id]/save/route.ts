import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  CLOAK_WATCH_POSTS_COLLECTION,
  CLOAK_WATCH_SAVES_COLLECTION,
  ensureCloakWatchIndexes,
  getSavesCountForPost,
  safeObjectId,
} from "@/lib/cloakWatch";

// The client sends the absolute save state it wants (true/false) rather than
// "toggle", so the request is idempotent — rapid clicks are debounced
// client-side down to a single network call for the final state.
function normalizeIsSaved(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

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
    const body = await request.json().catch(() => null);
    const targetIsSaved = normalizeIsSaved(body?.isSaved);

    if (!postId || !userId || targetIsSaved === null) {
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

    // Set the save to its final state atomically instead of read-then-write —
    // concurrent clicks can no longer race each other into a duplicate-key
    // error on the unique {postId, userId} index.
    if (targetIsSaved) {
      await savesCollection.updateOne(
        { postId, userId },
        {
          $set: { active: true, updatedAt: new Date() },
          $setOnInsert: { postId, userId, createdAt: new Date() },
        },
        { upsert: true },
      );
    } else {
      await savesCollection.updateOne(
        { postId, userId },
        { $set: { active: false, updatedAt: new Date() } },
      );
    }

    const saves = await getSavesCountForPost(db, postId);
    await db.collection(CLOAK_WATCH_POSTS_COLLECTION).updateOne(
      { _id: postId },
      { $set: { savesCount: saves, updatedAt: new Date() } },
    );

    return NextResponse.json({
      success: true,
      isSaved: targetIsSaved,
      saves,
    });
  } catch (error) {
    console.error("Error saving cloak watch post:", error);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }
}

