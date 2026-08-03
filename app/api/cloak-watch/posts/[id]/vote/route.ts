import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  CLOAK_WATCH_POSTS_COLLECTION,
  CLOAK_WATCH_VOTES_COLLECTION,
  ensureCloakWatchIndexes,
  getVoteCountsForPosts,
  safeObjectId,
} from "@/lib/cloakWatch";
import type { CloakWatchVoteValue } from "@/models/CloakWatch";

// The client sends the *absolute* vote it wants to end up with (1, -1, or 0
// to clear), not a "toggle this arrow" instruction. That makes the request
// idempotent, which matters because rapid clicks are debounced client-side
// down to a single network call representing the final state.
function normalizeVote(value: unknown): CloakWatchVoteValue | 0 | null {
  if (value === 1 || value === "up") return 1;
  if (value === -1 || value === "down") return -1;
  if (value === 0) return 0;
  return null;
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
    const body = await request.json();
    const nextVote = normalizeVote(body?.value);

    if (!postId || !userId || nextVote === null) {
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

    const votesCollection = db.collection(CLOAK_WATCH_VOTES_COLLECTION);
    const viewerVote: CloakWatchVoteValue | 0 = nextVote;

    // Set the vote to its final state atomically instead of read-then-write —
    // concurrent clicks (or clicks from multiple tabs) can no longer race
    // each other into a duplicate-key error on the unique {postId, userId}
    // index.
    if (nextVote === 0) {
      await votesCollection.deleteOne({ postId, userId });
    } else {
      await votesCollection.updateOne(
        { postId, userId },
        {
          $set: { value: nextVote, updatedAt: new Date() },
          $setOnInsert: { postId, userId, createdAt: new Date() },
        },
        { upsert: true },
      );
    }

    const voteCounts = await getVoteCountsForPosts(db, [postId]);
    const updatedCounts = voteCounts.get(postId.toString()) ?? { up: 0, down: 0 };

    await db.collection(CLOAK_WATCH_POSTS_COLLECTION).updateOne(
      { _id: postId },
      {
        $set: {
          upvotesCount: updatedCounts.up,
          downvotesCount: updatedCounts.down,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({
      success: true,
      up: updatedCounts.up,
      down: updatedCounts.down,
      viewerVote,
    });
  } catch (error) {
    console.error("Error voting on cloak watch post:", error);
    return NextResponse.json(
      { error: "Failed to update vote" },
      { status: 500 },
    );
  }
}
