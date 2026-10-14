import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getLinkPosts, reviewPost } from "@/lib/cloakWatchPosts";

const REJECTION_REASONS = ["Not me", "Incorrect Context", "Poor image match", "Other"];

// GET ?link=<watched link URL> — the posts the CV scraper found on that link
// (Cloak Watch's per-link list and post detail).
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const link = new URL(request.url).searchParams.get("link") || "";
    if (!link) {
      return NextResponse.json({ error: "Missing link." }, { status: 400 });
    }

    const db = await getDb();
    const data = await getLinkPosts(db, new ObjectId(session.user.id), link);
    if (!data) {
      return NextResponse.json({ error: "Link not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Error loading Cloak Watch posts:", error);
    return NextResponse.json({ error: "Couldn't load posts." }, { status: 500 });
  }
}

// PATCH { link, postId, status: "Confirmed" | "Rejected", reason? } —
// the user's decision on a post.
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const link = typeof body?.link === "string" ? body.link : "";
    const postId = typeof body?.postId === "string" ? body.postId : "";
    const status = body?.status;
    if (!link || !postId || (status !== "Confirmed" && status !== "Rejected")) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const reason =
      status === "Rejected" && REJECTION_REASONS.includes(body?.reason) ? body.reason : null;

    const db = await getDb();
    const result = await reviewPost(db, new ObjectId(session.user.id), link, postId, status, reason);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving post review:", error);
    return NextResponse.json({ error: "Couldn't save your decision." }, { status: 500 });
  }
}
