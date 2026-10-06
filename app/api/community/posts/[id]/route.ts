import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  CLOAK_WATCH_POSTS_COLLECTION,
  ensureCloakWatchIndexes,
  getViewerMetaForPosts,
  getVoteCountsForPosts,
  mapPostDocToFeedItem,
  safeObjectId,
} from "@/lib/cloakWatch";

export async function GET(
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

    if (!postId) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
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

    const [viewerMeta, voteCounts, author] = await Promise.all([
      getViewerMetaForPosts(db, userId, [post as any]),
      getVoteCountsForPosts(db, [post._id]),
      db.collection("users").findOne(
        { _id: post.authorId },
        {
          projection: {
            identityVerificationStatus: 1,
            username: 1,
            name: 1,
            image: 1,
            profileImage: 1,
          },
        },
      ),
    ]);
    return NextResponse.json({
      success: true,
      post: mapPostDocToFeedItem(
        post as any,
        viewerMeta.get(post._id.toString())!,
        voteCounts.get(post._id.toString()),
        author
          ? {
              username: author.username ?? null,
              displayName: author.name ?? null,
              avatarUrl: author.image || author.profileImage || null,
              verificationStatus: author.identityVerificationStatus ?? null,
            }
          : undefined,
      ),
    });
  } catch (error) {
    console.error("Error fetching cloak watch post:", error);
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
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

    if (!post.authorId.equals(userId)) {
      return NextResponse.json(
        { error: "Only the post owner can delete this post." },
        { status: 403 },
      );
    }

    await db.collection(CLOAK_WATCH_POSTS_COLLECTION).updateOne(
      { _id: postId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error soft deleting cloak watch post:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 },
    );
  }
}
