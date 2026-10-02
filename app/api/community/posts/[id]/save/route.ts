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

// See app/api/community/posts/[id]/vote/route.ts for why this exists — a
// quick save/unsave switch can leave two requests in flight, and serverless
// gives no ordering guarantee between them.
function readClientSeq(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Date.now();
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
    const clientSeq = readClientSeq(body?.clientSeq);

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
    // clientSeq-gated so a request that loses the race to reach the DB
    // (e.g. save-then-quickly-unsave) can't overwrite a click that
    // happened later — see the vote route for the full explanation.
    const orderingFilter = {
      $or: [{ clientSeq: { $exists: false } }, { clientSeq: { $lt: clientSeq } }],
    };
    if (targetIsSaved) {
      try {
        await savesCollection.updateOne(
          { postId, userId, ...orderingFilter },
          {
            $set: { active: true, clientSeq, updatedAt: new Date() },
            $setOnInsert: { postId, userId, createdAt: new Date() },
          },
          { upsert: true },
        );
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        // A newer click already won this race — not a real error.
      }
    } else {
      // No matching doc (not yet saved, or a newer write already won) is
      // a no-op, not an error — there's nothing to clear either way.
      await savesCollection.updateOne(
        { postId, userId, ...orderingFilter },
        { $set: { active: false, clientSeq, updatedAt: new Date() } },
      );
    }

    // Re-read current truth rather than trusting this request's own
    // intent — it may have lost the ordering race above.
    const current = await savesCollection.findOne({ postId, userId });
    const isSaved = Boolean(current?.active);

    const saves = await getSavesCountForPost(db, postId);
    await db.collection(CLOAK_WATCH_POSTS_COLLECTION).updateOne(
      { _id: postId },
      { $set: { savesCount: saves, updatedAt: new Date() } },
    );

    return NextResponse.json({
      success: true,
      isSaved,
      saves,
    });
  } catch (error) {
    console.error("Error saving cloak watch post:", error);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }
}

