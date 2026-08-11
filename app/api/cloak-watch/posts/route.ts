import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  CLOAK_WATCH_POSTS_COLLECTION,
  CLOAK_WATCH_SAVES_COLLECTION,
  createPostDocument,
  ensureCloakWatchIndexes,
  getViewerMetaForPosts,
  getVoteCountsForPosts,
  mapPostDocToFeedItem,
  safeObjectId,
  uploadCloakWatchImages,
} from "@/lib/cloakWatch";
import { checkLimit, getUpsellPayload, resolveUserPlan } from "@/lib/planLimits";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    await ensureCloakWatchIndexes(db);

    const userId = safeObjectId(session.user.id);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const scope = searchParams.get("scope");

    const baseFilter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (q) {
      baseFilter.$or = [
        { authorUsername: { $regex: q, $options: "i" } },
        { authorDisplayName: { $regex: q, $options: "i" } },
        { body: { $regex: q, $options: "i" } },
      ];
    }

    let posts: any[] = [];

    if (scope === "my" && userId) {
      posts = await db
        .collection(CLOAK_WATCH_POSTS_COLLECTION)
        .find({ ...baseFilter, authorId: userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
    } else if (scope === "saved" && userId) {
      const savedDocs = await db
        .collection(CLOAK_WATCH_SAVES_COLLECTION)
        .find({ userId, active: true })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray();

      const savedPostIds = savedDocs.map((doc) => doc.postId);

      if (savedPostIds.length) {
        const savedPosts = await db
          .collection(CLOAK_WATCH_POSTS_COLLECTION)
          .find({ ...baseFilter, _id: { $in: savedPostIds } })
          .toArray();

        const postsById = new Map(
          savedPosts.map((post) => [post._id.toString(), post]),
        );
        posts = savedPostIds
          .map((postId) => postsById.get(postId.toString()))
          .filter(Boolean);
      }
    } else {
      posts = await db
        .collection(CLOAK_WATCH_POSTS_COLLECTION)
        .find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
    }

    const authorIds = Array.from(
      new Set(
        posts
          .map((post) => post.authorId)
          .filter(Boolean)
          .map((authorId) => authorId.toString()),
      ),
    )
      .map((authorId) => safeObjectId(authorId))
      .filter((authorId): authorId is NonNullable<typeof authorId> =>
        Boolean(authorId),
      );

    // These three only depend on `posts`/`authorIds`, not on each other —
    // fetch them concurrently instead of one round trip at a time.
    const [viewerMeta, voteCounts, authors] = await Promise.all([
      getViewerMetaForPosts(db, userId, posts as any),
      getVoteCountsForPosts(
        db,
        posts.map((post) => post._id),
      ),
      authorIds.length
        ? db
            .collection("users")
            .find(
              { _id: { $in: authorIds } },
              {
                projection: {
                  identityVerificationStatus: 1,
                  username: 1,
                  name: 1,
                  image: 1,
                  profileImage: 1,
                },
              },
            )
            .toArray()
        : Promise.resolve([]),
    ]);

    const authorInfoMap = new Map(
      authors.map((author) => [
        author._id.toString(),
        {
          username: author.username ?? null,
          displayName: author.name ?? null,
          avatarUrl: author.image || author.profileImage || null,
          verificationStatus: author.identityVerificationStatus ?? null,
        },
      ]),
    );
    const items = posts.map((post) =>
      mapPostDocToFeedItem(
        post as any,
        viewerMeta.get(post._id.toString())!,
        voteCounts.get(post._id.toString()),
        authorInfoMap.get(post.authorId?.toString?.() || ""),
      ),
    );

    return NextResponse.json({ success: true, posts: items });
  } catch (error) {
    console.error("Error fetching cloak watch posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = safeObjectId(session.user.id);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const body = String(formData.get("body") || "").trim();
    const files = formData
      .getAll("images")
      .filter((file): file is File => file instanceof File);

    if (!files.length) {
      return NextResponse.json(
        { error: "Please upload at least one image." },
        { status: 400 },
      );
    }

    const db = await getDb();
    await ensureCloakWatchIndexes(db);

    const user = await db.collection("users").findOne({ _id: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const plan = await resolveUserPlan(db, userId);
    const postCheck = await checkLimit(db, { userId, plan, kind: "COMMUNITY_POST" });
    if (!postCheck.allowed) {
      // Check before uploading — a blocked user shouldn't pay for a wasted
      // Firebase upload.
      return NextResponse.json(getUpsellPayload(postCheck), { status: 403 });
    }

    const uploadedImages = await uploadCloakWatchImages(files, session.user.id);
    const username =
      user.username ||
      session.user.username ||
      user.email?.split("@")?.[0] ||
      "cloak-user";
    const avatarUrl =
      user.image || user.profileImage || "/images/placeholder_avatar.png";

    const postDoc = createPostDocument({
      authorId: userId,
      authorUsername: String(username),
      authorDisplayName: String(user.name || username),
      authorAvatarUrl: String(avatarUrl),
      authorVerificationStatus: user.identityVerificationStatus ?? null,
      authorLevel: Number(user.level || 1),
      body,
      images: uploadedImages,
    });

    const result = await db
      .collection(CLOAK_WATCH_POSTS_COLLECTION)
      .insertOne(postDoc);

    // We already have the full document we just inserted in memory —
    // re-fetching it is a redundant round trip.
    const created = { ...postDoc, _id: result.insertedId };

    return NextResponse.json({
      success: true,
      post: mapPostDocToFeedItem(
        created as any,
        {
          voteValue: 0,
          isSaved: false,
          isOwner: true,
        },
        undefined,
        {
          username: created.authorUsername,
          displayName: created.authorDisplayName,
          avatarUrl: created.authorAvatarUrl,
          verificationStatus: user.identityVerificationStatus ?? null,
        },
      ),
    });
  } catch (error) {
    console.error("Error creating cloak watch post:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create post",
      },
      { status: 500 },
    );
  }
}
