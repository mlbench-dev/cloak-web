import { ObjectId } from "mongodb";
import sharp from "sharp";
import { uploadFileToFirebase } from "@/lib/firebaseUtils";
import type {
  CloakWatchPostDoc,
  CloakWatchReportDoc,
  CloakWatchReportReason,
  CloakWatchSaveDoc,
  CloakWatchVoteDoc,
  CloakWatchVoteValue,
} from "@/models/CloakWatch";

export type CloakWatchFeedItem = {
  id: string;
  username: string;
  displayName: string;
  identityVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  level: number;
  createdAt: string;
  avatarUrl: string;
  body: string;
  images: CloakWatchImage[];
  up: number;
  down: number;
  shares: number;
  saves: number;
  reports: number;
  viewerVote: CloakWatchVoteValue | 0;
  isSaved: boolean;
  isOwner: boolean;
  isDeleted: boolean;
};

type ViewerMeta = {
  voteValue: CloakWatchVoteValue | 0;
  isSaved: boolean;
  isOwner: boolean;
};

type VoteCountOverride = {
  up: number;
  down: number;
};
export type CloakWatchImage = {
  url: string;
  thumbUrl: string;
};
export const CLOAK_WATCH_POSTS_COLLECTION = "cloakWatchPosts";
export const CLOAK_WATCH_VOTES_COLLECTION = "cloakWatchPostVotes";
export const CLOAK_WATCH_SAVES_COLLECTION = "cloakWatchPostSaves";
export const CLOAK_WATCH_REPORTS_COLLECTION = "cloakWatchPostReports";

export function safeObjectId(value?: string | null) {
  if (!value) return null;
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

// createIndex is idempotent but still costs a DB round trip per call, and
// this used to run on every community request. Cache the promise so index
// creation only happens once per server process instead of once per request.
let indexesEnsuredPromise: Promise<void> | null = null;

export function ensureCloakWatchIndexes(db: any) {
  if (!indexesEnsuredPromise) {
    indexesEnsuredPromise = Promise.all([
      db
        .collection(CLOAK_WATCH_POSTS_COLLECTION)
        .createIndex({ createdAt: -1, isDeleted: 1 }),
      db
        .collection(CLOAK_WATCH_POSTS_COLLECTION)
        .createIndex({ authorId: 1, createdAt: -1 }),
      db
        .collection(CLOAK_WATCH_VOTES_COLLECTION)
        .createIndex({ postId: 1, userId: 1 }, { unique: true }),
      db
        .collection(CLOAK_WATCH_SAVES_COLLECTION)
        .createIndex({ postId: 1, userId: 1 }, { unique: true }),
      db
        .collection(CLOAK_WATCH_REPORTS_COLLECTION)
        .createIndex({ postId: 1, userId: 1 }, { unique: true }),
    ])
      .then(() => undefined)
      .catch((err) => {
        // Allow the next request to retry if index creation failed.
        indexesEnsuredPromise = null;
        throw err;
      });
  }
  return indexesEnsuredPromise;
}

export type CloakWatchAuthorOverride = {
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  verificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
};

export function mapPostDocToFeedItem(
  post: CloakWatchPostDoc & { _id: ObjectId },
  viewer: ViewerMeta,
  voteCounts?: VoteCountOverride,
  // Posts store the author's username/avatar as a snapshot at creation
  // time. Pass the author's *current* profile data here so posts reflect
  // profile edits instead of showing whatever avatar was live when the
  // post was made.
  authorOverride?: CloakWatchAuthorOverride,
): CloakWatchFeedItem {
  return {
    id: post._id.toString(),
    username: authorOverride?.username || post.authorUsername,
    displayName: authorOverride?.displayName || post.authorDisplayName,
    identityVerificationStatus:
      authorOverride?.verificationStatus ?? post.authorVerificationStatus ?? null,
    level: post.authorLevel,
    createdAt: post.createdAt.toISOString(),
    avatarUrl: authorOverride?.avatarUrl || post.authorAvatarUrl,
    body: post.body,
    images: normalizePostImages(post),
    up: voteCounts?.up ?? post.upvotesCount,
    down: voteCounts?.down ?? post.downvotesCount,
    shares: post.sharesCount,
    saves: post.savesCount,
    reports: post.reportsCount,
    viewerVote: viewer.voteValue,
    isSaved: viewer.isSaved,
    isOwner: viewer.isOwner,
    isDeleted: post.isDeleted,
  };
}

export async function getVoteCountsForPosts(
  db: any,
  postIds: ObjectId[],
): Promise<Map<string, VoteCountOverride>> {
  if (!postIds.length) {
    return new Map();
  }

  const groupedVotes = await db
    .collection(CLOAK_WATCH_VOTES_COLLECTION)
    .aggregate([
      { $match: { postId: { $in: postIds } } },
      {
        $group: {
          _id: "$postId",
          up: {
            $sum: {
              $cond: [{ $eq: ["$value", 1] }, 1, 0],
            },
          },
          down: {
            $sum: {
              $cond: [{ $eq: ["$value", -1] }, 1, 0],
            },
          },
        },
      },
    ])
    .toArray();

  const counts = new Map<string, VoteCountOverride>();
  groupedVotes.forEach(
    (item: { _id: ObjectId; up?: number; down?: number }) => {
      counts.set(item._id.toString(), {
        up: item.up ?? 0,
        down: item.down ?? 0,
      });
    },
  );

  return counts;
}

export async function getSavesCountForPost(
  db: any,
  postId: ObjectId,
): Promise<number> {
  return db
    .collection(CLOAK_WATCH_SAVES_COLLECTION)
    .countDocuments({ postId, active: true });
}

export async function getViewerMetaForPosts(
  db: any,
  userId: ObjectId | null,
  posts: Array<CloakWatchPostDoc & { _id: ObjectId }>,
) {
  if (!posts.length) {
    return new Map<string, ViewerMeta>();
  }

  const fallback = new Map<string, ViewerMeta>();
  posts.forEach((post) => {
    fallback.set(post._id.toString(), {
      voteValue: 0,
      isSaved: false,
      isOwner: !!userId && post.authorId.equals(userId),
    });
  });

  if (!userId) return fallback;

  const postIds = posts.map((post) => post._id);
  const [votes, saves] = await Promise.all([
    db
      .collection(CLOAK_WATCH_VOTES_COLLECTION)
      .find({ postId: { $in: postIds }, userId })
      .toArray(),
    db
      .collection(CLOAK_WATCH_SAVES_COLLECTION)
      .find({ postId: { $in: postIds }, userId, active: true })
      .toArray(),
  ]);

  const voteMap = new Map<string, CloakWatchVoteValue>();
  votes.forEach((vote: CloakWatchVoteDoc) => {
    voteMap.set(vote.postId.toString(), vote.value);
  });

  const saveMap = new Set<string>();
  saves.forEach((save: CloakWatchSaveDoc) => {
    saveMap.add(save.postId.toString());
  });

  posts.forEach((post) => {
    fallback.set(post._id.toString(), {
      voteValue: voteMap.get(post._id.toString()) || 0,
      isSaved: saveMap.has(post._id.toString()),
      isOwner: post.authorId.equals(userId),
    });
  });

  return fallback;
}

export async function uploadCloakWatchImages(
  files: File[],
  userId: string,
): Promise<CloakWatchImage[]> {
  // Uploads for different files are independent — run them concurrently
  // instead of one at a time.
  return Promise.all(files.map((file) => uploadSingleCloakWatchImage(file, userId)));
}

async function uploadSingleCloakWatchImage(
  file: File,
  userId: string,
): Promise<CloakWatchImage> {
  const contentType = file.type.toLowerCase();
  // HEIC/HEIF and other formats browsers can't decode make it through the
  // client-side accept filter if someone bypasses the picker (drag-drop,
  // scripted upload, etc.) — reject them here too rather than letting sharp
  // throw a cryptic error later.
  if (!["image/png", "image/jpeg"].includes(contentType)) {
    throw new Error("Only PNG or JPEG images are supported.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Each image must be 5 MB or smaller.");
  }

  const safeName = file.name.replace(/\s+/g, "_");
  const buffer = Buffer.from(await file.arrayBuffer());

  let fullBuffer;
  let thumbBuffer;
  try {
    // Downscale to a size that's still plenty sharp for full-screen mobile
    // viewing. Phone cameras often produce 4000px+ originals — uploading
    // those unmodified is several times slower for no visible benefit.
    fullBuffer = await sharp(buffer)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // generate a tiny, heavily-compressed placeholder (~2-5kb)
    thumbBuffer = await sharp(buffer)
      .resize({ width: 24 }) // tiny — this is what keeps file size down
      .jpeg({ quality: 30 })
      .toBuffer();
  } catch (error) {
    // libheif/libvips reject some HEIC/HEIF files outright (e.g. "Security
    // limit exceeded: Number of references in iref box... exceeds the
    // security limits of 16 references") when a file's internal item-
    // reference box is unusually large — some camera apps pack many
    // auxiliary derivations (depth maps, portrait data, multiple
    // thumbnails) into one HEIC container, which trips that hardening
    // limit. That raw message means nothing to a user, so surface a
    // friendly, actionable one instead.
    console.error("Error processing uploaded image with sharp:", error);
    throw new Error(
      "We couldn't process that image — it may be corrupted or in an unsupported format. Please try a different photo (JPEG or PNG works best).",
    );
  }

  const fullFile = new File(
    [fullBuffer],
    safeName.replace(/\.[^.]+$/, ".jpg"),
    { type: "image/jpeg" },
  );

  const thumbFile = new File(
    [thumbBuffer],
    `thumb_${safeName.replace(/\.[^.]+$/, "")}.jpg`,
    { type: "image/jpeg" },
  );

  const timestamp = Date.now();
  const fullPath = `uploads/cloak_watch/${userId}/${timestamp}_${safeName}`;
  const thumbPath = `uploads/cloak_watch/${userId}/thumbs/${timestamp}_thumb_${safeName}`;

  // The full-size and thumbnail uploads are independent — run them
  // concurrently instead of sequentially.
  const [url, thumbUrl] = await Promise.all([
    uploadFileToFirebase(fullFile, fullPath),
    uploadFileToFirebase(thumbFile, thumbPath),
  ]);

  return { url, thumbUrl };
}
function normalizePostImages(post: any): CloakWatchImage[] {
  if (Array.isArray(post.images) && post.images.length > 0) {
    return post.images;
  }
  // legacy posts stored images as imageUrls: string[]
  if (Array.isArray(post.imageUrls)) {
    return post.imageUrls.map((url: string) => ({ url, thumbUrl: url }));
  }
  return [];
}
export function normalizeReportReason(
  input: string,
): CloakWatchReportReason | null {
  const allowed: CloakWatchReportReason[] = [
    "Spam or Scams",
    "Hate Speech",
    "Harassment",
    "Misleading Information",
    "Other",
  ];
  return allowed.includes(input as CloakWatchReportReason)
    ? (input as CloakWatchReportReason)
    : null;
}

export function createPostDocument(input: {
  authorId: ObjectId;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  authorVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  authorLevel: number;
  body: string;
  images: CloakWatchImage[]; // was: imageUrls: string[]
}): CloakWatchPostDoc {
  const now = new Date();
  return {
    authorId: input.authorId,
    authorUsername: input.authorUsername,
    authorDisplayName: input.authorDisplayName,
    authorAvatarUrl: input.authorAvatarUrl,
    authorVerificationStatus: input.authorVerificationStatus ?? null,
    authorLevel: input.authorLevel,
    body: input.body,
    images: input.images, // was: imageUrls: input.imageUrls
    upvotesCount: 0,
    downvotesCount: 0,
    sharesCount: 0,
    savesCount: 0,
    reportsCount: 0,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createReportDocument(input: {
  postId: ObjectId;
  userId: ObjectId;
  reason: CloakWatchReportReason;
  details: string;
}): CloakWatchReportDoc {
  const now = new Date();
  return {
    postId: input.postId,
    userId: input.userId,
    reason: input.reason,
    details: input.details,
    createdAt: now,
    updatedAt: now,
  };
}
