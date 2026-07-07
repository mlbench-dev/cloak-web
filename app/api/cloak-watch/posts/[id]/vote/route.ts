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

function normalizeVote(value: unknown): CloakWatchVoteValue | null {
  if (value === 1 || value === "up") return 1;
  if (value === -1 || value === "down") return -1;
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

    if (!postId || !userId || !nextVote) {
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
    const existingVote = await votesCollection.findOne({ postId, userId });

    let viewerVote: CloakWatchVoteValue | 0 = nextVote;

    if (!existingVote) {
      await votesCollection.insertOne({
        postId,
        userId,
        value: nextVote,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (existingVote.value === nextVote) {
      await votesCollection.deleteOne({ _id: existingVote._id });
      viewerVote = 0;
    } else {
      await votesCollection.updateOne(
        { _id: existingVote._id },
        { $set: { value: nextVote, updatedAt: new Date() } },
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
