import { createHash } from "node:crypto";
import type { Db, ObjectId } from "mongodb";
import { FETCH_URL_COLLECTION, type FetchUrlDoc, type FetchedLink } from "@/lib/fetchLinks";
import { watchedLinkKey } from "@/lib/watchedLinkUrl";

// Posts the CV scraper found on a watched link, for Cloak Watch's per-link
// list and post detail pages. The CV API stores them in scrapingUrl (one doc
// per user, `scrapingResults`); each result's `uuid` is the LINK it came
// from (fetchUrl.links[].uuid) and its `url` is the post itself. The user's
// Confirm/Reject decisions live in our own collection, so the CV data is
// never modified.

const SCRAPING_URL_COLLECTION = "scrapingUrl";
const REVIEWS_COLLECTION = "cloakWatchPostReviews";

type ScrapedPostDoc = {
  uuid?: string;
  url?: string;
  sentiment?: string;
  sentimentscore?: number;
  matchingscore?: number;
  matchinglevel?: string;
  attentionscore?: number;
  content?: string;
  // The CV API's written explanation of the post (newer scrapes only).
  "content-analysis"?: string;
  publishedAt?: string | Date;
  scrapedAt?: string | Date;
};

export type PostStatus = "New" | "Confirmed" | "Rejected";

export type CloakWatchPost = {
  // Stable id from the post URL (URLs are long and awkward in routes).
  id: string;
  number: number;
  url: string;
  publishedAt: string | null;
  scrapedAt: string | null;
  // 0–100, from the CV API's matchingscore (0–1).
  matchPercent: number | null;
  matchLevel: string | null;
  sentiment: string | null;
  sentimentPercent: number | null;
  attentionPercent: number | null;
  content: string;
  // The CV API's own analysis text, when it sent one.
  contentAnalysis: string | null;
  status: PostStatus;
  rejectionReason: string | null;
};

export type LinkPosts = {
  link: { uuid: string; url: string; platform: string; scrapeError: string | null };
  posts: CloakWatchPost[];
};

type ReviewDoc = {
  userId: ObjectId;
  postId: string;
  linkUuid: string;
  status: Exclude<PostStatus, "New">;
  reason?: string | null;
  reviewedAt: Date;
};

export function postIdFor(postUrl: string): string {
  return createHash("sha1").update(postUrl).digest("hex").slice(0, 12);
}

// postIdFor ids of every post the user has confirmed or rejected.
export async function getReviewedPostIds(db: Db, userId: ObjectId): Promise<Set<string>> {
  const reviews = await db
    .collection<ReviewDoc>(REVIEWS_COLLECTION)
    .find({ userId }, { projection: { postId: 1 } })
    .toArray();
  return new Set(reviews.map((review) => review.postId));
}

// The CV service's reason for a failed scrape. Only shown while the link is
// actually failed — a stale error can linger after a later success.
function linkScrapeError(link: FetchedLink): string | null {
  if (link.scrapeStatus !== "failed") return null;
  return typeof link.error === "string" && link.error.trim() ? link.error.trim() : null;
}

function toPercent(value: number | undefined): number | null {
  return typeof value === "number" ? Math.round(value * 100) : null;
}

function toIso(value: string | Date | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// The watched link (by URL, as Cloak Watch routes carry it) → its uuid.
async function findLink(db: Db, userId: ObjectId, linkUrl: string) {
  const doc = await db
    .collection<FetchUrlDoc>(FETCH_URL_COLLECTION)
    .findOne({ userId }, { projection: { links: 1 } });
  const key = watchedLinkKey(linkUrl);
  return (doc?.links ?? []).find((link) => watchedLinkKey(link.url) === key) ?? null;
}

export async function getLinkPosts(
  db: Db,
  userId: ObjectId,
  linkUrl: string,
): Promise<LinkPosts | null> {
  const link = await findLink(db, userId, linkUrl);
  if (!link) return null;

  const [scraped, reviews] = await Promise.all([
    db
      .collection<{ scrapingResults?: ScrapedPostDoc[] }>(SCRAPING_URL_COLLECTION)
      .findOne({ userId }, { projection: { scrapingResults: 1 } }),
    db
      .collection<ReviewDoc>(REVIEWS_COLLECTION)
      .find({ userId, linkUuid: link.uuid })
      .toArray(),
  ]);
  const reviewById = new Map(reviews.map((review) => [review.postId, review]));

  // Newest post first; the same post can't appear twice.
  const seen = new Set<string>();
  const results = (scraped?.scrapingResults ?? [])
    .filter((post) => post.uuid === link.uuid && typeof post.url === "string")
    .filter((post) => !seen.has(post.url as string) && Boolean(seen.add(post.url as string)))
    .sort((a, b) => {
      const at = new Date(a.publishedAt ?? a.scrapedAt ?? 0).getTime();
      const bt = new Date(b.publishedAt ?? b.scrapedAt ?? 0).getTime();
      return bt - at;
    });

  const posts = results.map((post, index): CloakWatchPost => {
    const id = postIdFor(post.url as string);
    const review = reviewById.get(id);
    return {
      id,
      number: index + 1,
      url: post.url as string,
      publishedAt: toIso(post.publishedAt),
      scrapedAt: toIso(post.scrapedAt),
      matchPercent: toPercent(post.matchingscore),
      matchLevel: post.matchinglevel ?? null,
      sentiment: post.sentiment ?? null,
      sentimentPercent: toPercent(post.sentimentscore),
      attentionPercent: toPercent(post.attentionscore),
      content: post.content ?? "",
      contentAnalysis: post["content-analysis"]?.trim() || null,
      status: review?.status ?? "New",
      rejectionReason: review?.reason ?? null,
    };
  });

  return {
    link: { uuid: link.uuid, url: link.url, platform: link.platform, scrapeError: linkScrapeError(link) },
    posts,
  };
}

// Confirm Match / Reject Match on the post detail page.
export async function reviewPost(
  db: Db,
  userId: ObjectId,
  linkUrl: string,
  postId: string,
  status: Exclude<PostStatus, "New">,
  reason: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = await getLinkPosts(db, userId, linkUrl);
  if (!data || !data.posts.some((post) => post.id === postId)) {
    return { ok: false, error: "Post not found." };
  }

  await db.collection<ReviewDoc>(REVIEWS_COLLECTION).updateOne(
    { userId, postId },
    {
      $set: {
        linkUuid: data.link.uuid,
        status,
        reason: status === "Rejected" ? reason : null,
        reviewedAt: new Date(),
      },
      $setOnInsert: { userId, postId },
    },
    { upsert: true },
  );
  return { ok: true };
}

// ---- Cloak Watch overview (main page) ----------------------------------

export type WatchedLinkSummary = {
  uuid: string;
  url: string;
  platform: string;
  // CV progress for this link: pending / queued / in_progress / complete / failed.
  scrapeStatus: string | null;
  scrapeUpdatedAt: string | null;
  // Why the last scrape failed, from the CV service; null unless failed.
  scrapeError: string | null;
  totalPosts: number;
  // Posts not yet confirmed or rejected.
  newPosts: number;
};

export type CloakWatchOverview = {
  links: WatchedLinkSummary[];
  stats: {
    // Posts found across all watched links.
    found: number;
    confirmed: number;
    // confirmed ÷ (confirmed + rejected); null before any decision.
    accuracy: number | null;
  };
};

export async function getCloakWatchOverview(
  db: Db,
  userId: ObjectId,
): Promise<CloakWatchOverview> {
  const [fetchUrlDoc, scraped, reviews] = await Promise.all([
    db.collection<FetchUrlDoc>(FETCH_URL_COLLECTION).findOne({ userId }, { projection: { links: 1 } }),
    db
      .collection<{ scrapingResults?: ScrapedPostDoc[] }>(SCRAPING_URL_COLLECTION)
      .findOne({ userId }, { projection: { "scrapingResults.uuid": 1, "scrapingResults.url": 1 } }),
    db.collection<ReviewDoc>(REVIEWS_COLLECTION).find({ userId }).toArray(),
  ]);

  const watched = (fetchUrlDoc?.links ?? []).filter(
    (link) => link?.url && link.status === "approved",
  );
  const watchedUuids = new Set(watched.map((link) => link.uuid));
  const reviewById = new Map(reviews.map((review) => [review.postId, review.status]));

  // Unique posts per watched link.
  const postsByLink = new Map<string, Set<string>>();
  for (const post of scraped?.scrapingResults ?? []) {
    if (!post.uuid || !post.url || !watchedUuids.has(post.uuid)) continue;
    if (!postsByLink.has(post.uuid)) postsByLink.set(post.uuid, new Set());
    postsByLink.get(post.uuid)!.add(post.url);
  }

  let found = 0;
  let confirmed = 0;
  let rejected = 0;
  const links = watched.map((link): WatchedLinkSummary => {
    const postUrls = Array.from(postsByLink.get(link.uuid) ?? []);
    let newPosts = 0;
    for (const postUrl of postUrls) {
      const status = reviewById.get(postIdFor(postUrl));
      if (status === "Confirmed") confirmed += 1;
      else if (status === "Rejected") rejected += 1;
      else newPosts += 1;
    }
    found += postUrls.length;
    return {
      uuid: link.uuid,
      url: link.url,
      platform: link.platform,
      scrapeStatus: link.scrapeStatus ?? null,
      scrapeUpdatedAt: link.scrapeUpdatedAt ? new Date(link.scrapeUpdatedAt).toISOString() : null,
      scrapeError: linkScrapeError(link),
      totalPosts: postUrls.length,
      newPosts,
    };
  });

  const reviewed = confirmed + rejected;
  return {
    links,
    stats: {
      found,
      confirmed,
      accuracy: reviewed > 0 ? Math.round((confirmed / reviewed) * 100) : null,
    },
  };
}
