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
import { notifyPostRapidAction, notifyPostVote } from "@/lib/notifications";

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

// A quick up->down (or down->up) switch can leave two vote requests in
// flight at once — on serverless there's no guarantee they reach the DB in
// the order they were clicked. clientSeq (Date.now() at send time, from
// the browser) lets the write itself enforce "last click wins": a write
// only applies if no newer clientSeq has already been stored, so an
// out-of-order arrival can't clobber a click the user made later.
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
    const body = await request.json();
    const nextVote = normalizeVote(body?.value);
    const clientSeq = readClientSeq(body?.clientSeq);

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
    let viewerVote: CloakWatchVoteValue | 0 = nextVote;

    // Set the vote to its final state atomically instead of read-then-write,
    // gated on clientSeq so a request that lost the race to reach the DB
    // (e.g. the "up" request from before a quick switch to "down") can
    // never overwrite a click that actually happened later. findOneAndUpdate's
    // "before" snapshot doubles as the signal for whether this is a
    // genuinely new/changed vote (worth notifying about) vs a redundant
    // re-send of the same value.
    let previousValue: CloakWatchVoteValue | undefined;
    let applied = true;
    if (nextVote === 0) {
      const removed = await votesCollection.findOneAndDelete({
        postId,
        userId,
        $or: [{ clientSeq: { $exists: false } }, { clientSeq: { $lt: clientSeq } }],
      });
      applied = Boolean(removed);
      previousValue = removed?.value;
    } else {
      try {
        const previous = await votesCollection.findOneAndUpdate(
          {
            postId,
            userId,
            $or: [
              { clientSeq: { $exists: false } },
              { clientSeq: { $lt: clientSeq } },
            ],
          },
          {
            $set: { value: nextVote, clientSeq, updatedAt: new Date() },
            $setOnInsert: { postId, userId, createdAt: new Date() },
          },
          { upsert: true, returnDocument: "before" },
        );
        previousValue = previous?.value;
      } catch (error: any) {
        // The filter above only matches "no doc yet" or "an older
        // clientSeq" — so if a *newer* clientSeq already won, this upsert
        // finds no match and (correctly) tries to insert, colliding with
        // the unique {postId, userId} index. That's not a real error, just
        // confirmation this request lost the race — nothing to apply.
        if (error?.code === 11000) {
          applied = false;
        } else {
          throw error;
        }
      }
    }

    if (!applied) {
      // A newer click already won — reflect *current* truth in the
      // response instead of this stale request's intent, so the client
      // corrects itself instead of showing an error for something the
      // user's later click already superseded.
      const current = await votesCollection.findOne({ postId, userId });
      viewerVote = current?.value ?? 0;
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

    const isSelfVote = post.authorId.equals(userId);
    const valueChanged = applied && nextVote !== 0 && previousValue !== nextVote;

    if (valueChanged && !isSelfVote) {
      const voter = await db
        .collection("users")
        .findOne(
          { _id: userId },
          { projection: { username: 1, image: 1, profileImage: 1 } },
        );

      await notifyPostVote(db, {
        authorId: post.authorId,
        voter,
        postId,
        value: nextVote,
      });
    }

    if (updatedCounts.up === 2) {
      await notifyPostRapidAction(db, {
        authorId: post.authorId,
        postId,
        postImageUrl: post.images?.[0]?.thumbUrl || post.images?.[0]?.url,
        authorAvatarUrl: post.authorAvatarUrl,
      });
    }

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
