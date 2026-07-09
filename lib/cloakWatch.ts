import { ObjectId } from "mongodb";
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
  images: string[];
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

export async function ensureCloakWatchIndexes(db: any) {
  await Promise.all([
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
  ]);
}

export function mapPostDocToFeedItem(
  post: CloakWatchPostDoc & { _id: ObjectId },
  viewer: ViewerMeta,
  voteCounts?: VoteCountOverride,
  authorVerificationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null,
): CloakWatchFeedItem {
  return {
    id: post._id.toString(),
    username: post.authorUsername,
    displayName: post.authorDisplayName,
    identityVerificationStatus:
      authorVerificationStatus ?? post.authorVerificationStatus ?? null,
    level: post.authorLevel,
    createdAt: post.createdAt.toISOString(),
    avatarUrl: post.authorAvatarUrl,
    body: post.body,
    images: post.imageUrls,
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

export async function uploadCloakWatchImages(files: File[], userId: string) {
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const contentType = file.type.toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error("Only image uploads are supported.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Each image must be 10 MB or smaller.");
    }

    const safeName = file.name.replace(/\s+/g, "_");
    const storagePath = `uploads/cloak_watch/${userId}/${Date.now()}_${safeName}`;
    const url = await uploadFileToFirebase(file, storagePath);
    uploadedUrls.push(url);
  }

  return uploadedUrls;
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
  imageUrls: string[];
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
    imageUrls: input.imageUrls,
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
