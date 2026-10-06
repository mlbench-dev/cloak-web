import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  CLOAK_WATCH_POSTS_COLLECTION,
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
    if (!postId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const db = await getDb();
    await ensureCloakWatchIndexes(db);

    const result = await db.collection(CLOAK_WATCH_POSTS_COLLECTION).findOneAndUpdate(
      { _id: postId, isDeleted: { $ne: true } },
      { $inc: { sharesCount: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      shares: result.sharesCount || 0,
    });
  } catch (error) {
    console.error("Error sharing cloak watch post:", error);
    return NextResponse.json(
      { error: "Failed to share post" },
      { status: 500 },
    );
  }
}

