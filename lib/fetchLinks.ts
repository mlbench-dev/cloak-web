import http from "node:http";
import https from "node:https";
import type { Db, ObjectId } from "mongodb";
import { LINK_CHANGE_WINDOW_DAYS, MANUAL_SCAN_UNLOCK_DAYS, PLAN_LIMITS } from "@/lib/config";
import { resolveUserPlan } from "@/lib/planLimits";
import { notifyScrapeComplete } from "@/lib/notifications";
import { watchedLinkKey } from "@/lib/watchedLinkUrl";

// Everything about the CV team's link-discovery ("fetch-url") service lives
// here and is only imported by API routes, so the service URL never reaches
// the browser bundle or the network tab.

export const IDENTITY_PROFILES_COLLECTION = "identityProfiles";
export const FETCH_URL_COLLECTION = "fetchUrl";

// Status values on fetchUrl.links[]. The CV service writes new links as
// "pending"; the user then keeps or dismisses them on Confirm Links.
// TODO(CV team): confirm "approved"/"rejected" are the strings the
// scraper keys off before this goes live.
export const LINK_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type FetchedLink = {
  uuid: string;
  platform: string;
  url: string;
  status: string;
  // CV-owned: pending (never scraped) / queued / in_progress / complete / failed.
  scrapeStatus?: string;
  scrapeUpdatedAt?: Date;
  // "manual" = typed into Known Websites; absent = found by the CV fetch.
  source?: "manual";
  addedAt?: Date;
};

// Written by the CV service. Older docs carry a flat `urls` array instead
// of `links`.
export type FetchUrlDoc = {
  userId: ObjectId;
  links?: FetchedLink[];
  urls?: string[];
  updatedAt?: Date;
};

// The CV services can be slow (cold starts, many URLs per call). Abort a
// bit before the routes' maxDuration (600s) so the job is marked failed
// cleanly instead of the platform killing it mid-way.
const CV_API_TIMEOUT_MS = 570_000;

// A job still "running" after this long was killed without finishing
// (deploy, crash, platform timeout) — treat it as failed so it can't block
// new fetches forever.
const STALE_JOB_MS = 11 * 60 * 1000;

function firstLine(value: string | undefined): string {
  return (value || "").split(/\r?\n/)[0].trim();
}

// JSON POST over node:http(s) rather than fetch(): Node's built-in fetch
// gives up after 5 minutes without response headers (undici's
// headersTimeout), and a scrape can take longer than that. Here the only
// limit is `timeoutMs`.
function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; json: unknown }> {
  const payload = JSON.stringify(body);
  const target = new URL(url);
  const client = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      target,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(payload) },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let json: unknown = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
        res.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error(`Timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end(payload);
  });
}

// POSTs to a CV service path (CV_API_URL + path). Server-side only, so the
// service URL never reaches the browser.
async function callCvApi(
  path: string,
  body: unknown,
  timeoutMs: number = CV_API_TIMEOUT_MS,
): Promise<
  | { ok: true; json: unknown }
  | { ok: false; reason: "not-configured" | "unreachable" | "error"; status?: number }
> {
  const base = firstLine(process.env.CV_API_URL).replace(/\/+$/, "");
  if (!base) {
    console.error(`CV_API_URL is not configured — cannot call ${path}.`);
    return { ok: false, reason: "not-configured" };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Only used if the CV service ever starts requiring auth.
  const bearerToken = firstLine(process.env.CV_API_BEARER_TOKEN);
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  let response: { status: number; json: unknown };
  try {
    response = await postJson(`${base}${path}`, body, headers, timeoutMs);
  } catch (error) {
    console.error(`CV API ${path}: could not reach the service in time:`, error);
    return { ok: false, reason: "unreachable" };
  }

  if (response.status < 200 || response.status >= 300) {
    console.error(`CV API ${path}: service returned an error:`, response.status, response.json);
    return { ok: false, reason: "error", status: response.status };
  }
  return { ok: true, json: response.json };
}

export type ProfileRequirement = "fullName" | "usernames" | "keywords" | "referenceMedia";

export type ProfileCompleteness = {
  complete: boolean;
  // In display order, for "add X and Y" prompts.
  missing: ProfileRequirement[];
};

// What a profile needs before link discovery (the CV API) may run: a full
// name, at least one username, at least one keyword, and reference media —
// at least one active reference image, with every active image verified
// (a newly added, not-yet-verified photo makes it incomplete again). Aliases and Known Websites are optional. This is the only place
// the rule lives; the fetch gate, the first-save trigger, Cloak Watch and
// the dashboard all read it from here.
export async function getProfileCompleteness(
  db: Db,
  userId: ObjectId,
): Promise<ProfileCompleteness> {
  const [profile, mediaCounts] = await Promise.all([
    db
      .collection<{ fullName?: string; usernames?: string[]; keywords?: string[] }>(
        IDENTITY_PROFILES_COLLECTION,
      )
      .findOne({ userId }, { projection: { fullName: 1, usernames: 1, keywords: 1 } }),
    db
      .collection("referenceMedia")
      .aggregate<{ total: number; verified: number }>([
        { $match: { userId, status: "active" } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ["$verificationStatus", "verified"] }, 1, 0] },
            },
          },
        },
      ])
      .next(),
  ]);
  const referenceMediaComplete =
    !!mediaCounts && mediaCounts.total > 0 && mediaCounts.verified === mediaCounts.total;

  const missing: ProfileRequirement[] = [];
  if (!profile?.fullName?.trim()) missing.push("fullName");
  if (!profile?.usernames?.length) missing.push("usernames");
  if (!profile?.keywords?.length) missing.push("keywords");
  if (!referenceMediaComplete) missing.push("referenceMedia");

  return { complete: missing.length === 0, missing };
}

// ---- Watched-link limits ------------------------------------------------
// A user's watched links = fetchUrl.links with status "approved" (typed
// into Known Websites or kept on Confirm Links). PLAN_LIMITS.maxLinks caps
// them; linkChangesPerWindow caps removals per LINK_CHANGE_WINDOW_DAYS.

export type LinkAllowance = {
  limit: number;
  count: number;
  // How many more links fit.
  room: number;
  changesPerWindow: number;
  changesLeft: number;
  // When the oldest change in the window expires (only if none are left).
  nextChangeAt: string | null;
};

export async function getApprovedLinks(db: Db, userId: ObjectId): Promise<FetchedLink[]> {
  const doc = await db
    .collection<FetchUrlDoc>(FETCH_URL_COLLECTION)
    .findOne({ userId }, { projection: { links: 1 } });
  return (doc?.links ?? []).filter((link) => link?.url && link.status === LINK_STATUS.APPROVED);
}

export async function getLinkAllowance(db: Db, userId: ObjectId): Promise<LinkAllowance> {
  const [plan, approved, user] = await Promise.all([
    resolveUserPlan(db, userId),
    getApprovedLinks(db, userId),
    db
      .collection<{ linkChanges?: Date[] }>("users")
      .findOne({ _id: userId }, { projection: { linkChanges: 1 } }),
  ]);
  return computeLinkAllowance(plan, approved.length, user?.linkChanges);
}

// The allowance from already-loaded data (no queries) — shared by
// getLinkAllowance and getLinkFetchStatus, which loads everything at once.
function computeLinkAllowance(
  plan: keyof typeof PLAN_LIMITS,
  approvedCount: number,
  linkChanges: Date[] | undefined,
): LinkAllowance {
  const { maxLinks, linkChangesPerWindow } = PLAN_LIMITS[plan];

  const windowStart = Date.now() - LINK_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentChanges = (linkChanges ?? [])
    .map((at) => new Date(at).getTime())
    .filter((at) => at > windowStart)
    .sort((a, b) => a - b);
  const changesLeft = Math.max(0, linkChangesPerWindow - recentChanges.length);
  const nextChangeAt =
    linkChangesPerWindow > 0 && changesLeft === 0 && recentChanges.length > 0
      ? new Date(recentChanges[0] + LINK_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;

  return {
    limit: maxLinks,
    count: approvedCount,
    room: Math.max(0, maxLinks - approvedCount),
    changesPerWindow: linkChangesPerWindow,
    changesLeft,
    nextChangeAt,
  };
}

// When saving the identity profile should kick off link discovery.
// Currently: only the first time the profile is complete — i.e. until a
// fetch has succeeded once. Change this one function to alter the rule
// (e.g. re-fetch on every complete save).
export async function shouldAutoFetchLinks(
  db: Db,
  userId: ObjectId,
): Promise<boolean> {
  const { complete } = await getProfileCompleteness(db, userId);
  if (!complete) return false;
  const [user, allowance] = await Promise.all([
    db.collection("users").findOne({ _id: userId }, { projection: { initialLinkFetchAt: 1 } }),
    getLinkAllowance(db, userId),
  ]);
  // Links typed into Known Websites use up room; nothing to fetch if full.
  return !user?.initialLinkFetchAt && allowance.room > 0;
}

// One link-discovery run, stored on the user doc as `linkFetch` so any
// screen (identity-profile flow, Cloak Watch, dashboard) can show it —
// the run itself happens server-side in the background.
export type LinkFetchJob = {
  status: "running" | "done" | "failed";
  startedAt: Date;
  finishedAt?: Date | null;
  // URLs this run found — what Confirm Links shows.
  urls?: string[];
  error?: string | null;
  // Set once the user has kept/dismissed this run's links.
  reviewedAt?: Date | null;
};

export type LinkFetchStatus = {
  status: "idle" | "running" | "done" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  // Finished with links the user hasn't kept/dismissed yet.
  awaitingReview: boolean;
  urls: string[];
  // Every getProfileCompleteness requirement is met — needed before any
  // fetch. `missingProfile` lists what's still needed.
  profileComplete: boolean;
  missingProfile: ProfileRequirement[];
  // A fetch has succeeded at least once for this user.
  everFetched: boolean;
  // Post scraping on the links the user kept (see startScrapeRun).
  scrape: ScrapeStatus;
  // Watched-link limit and Pro change allowance.
  links: LinkAllowance;
};

// One scraping run over the links the user kept on Confirm Links, stored on
// the user doc as `scrapeJob`. The CV API answers "started" straight away
// and scrapes in the background; per-link progress lives in
// fetchUrl.links[].scrapeStatus (written by the CV API), and it calls
// /api/scrape/callback as each link finishes.
export type ScrapeJob = {
  status: "running" | "done" | "failed";
  startedAt: Date;
  finishedAt?: Date | null;
  // The CV API's queuedLinks — callbacks are matched by these uuids, and
  // the run is done when all of them are complete/failed.
  links: { uuid: string; url: string }[];
  // What we asked for — re-sent by "Try Again".
  requestedUrls: string[];
  error?: string | null;
  // "user" = Confirm Links / Known Websites / Try Again;
  // "scheduled" = the periodic re-scrape for paid plans;
  // "manual" = the dashboard's Scan button (free plans).
  trigger?: "user" | "scheduled" | "manual";
};

export type ScrapeStatus = {
  status: "idle" | "running" | "done" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  linkCount: number;
  // Links that reached complete/failed so far.
  finishedCount: number;
  failedCount: number;
};

function isStale(job: { status: string; startedAt: Date }): boolean {
  return (
    job.status === "running" &&
    Date.now() - new Date(job.startedAt).getTime() > STALE_JOB_MS
  );
}

export async function getLinkFetchStatus(
  db: Db,
  userId: ObjectId,
): Promise<LinkFetchStatus> {
  // Everything this status needs, read once and in parallel — the user doc
  // and fetchUrl feed the link allowance and scrape progress below, instead
  // of each helper re-reading them. Polled often, so it's kept lean.
  const [user, fetchUrlDoc, completeness, plan] = await Promise.all([
    db
      .collection<{
        linkFetch?: LinkFetchJob;
        scrapeJob?: ScrapeJob;
        initialLinkFetchAt?: Date;
        linkChanges?: Date[];
      }>("users")
      .findOne(
        { _id: userId },
        { projection: { linkFetch: 1, scrapeJob: 1, initialLinkFetchAt: 1, linkChanges: 1 } },
      ),
    db
      .collection<FetchUrlDoc>(FETCH_URL_COLLECTION)
      .findOne({ userId }, { projection: { links: 1 } }),
    getProfileCompleteness(db, userId),
    resolveUserPlan(db, userId),
  ]);
  const links = fetchUrlDoc?.links ?? [];
  const approvedCount = links.filter(
    (link) => link?.url && link.status === LINK_STATUS.APPROVED,
  ).length;
  const allowance = computeLinkAllowance(plan, approvedCount, user?.linkChanges);

  const job = user?.linkFetch;
  const profileComplete = completeness.complete;
  const missingProfile = completeness.missing;
  const everFetched = Boolean(user?.initialLinkFetchAt);
  const scrape = await getScrapeStatus(db, userId, user?.scrapeJob, links);

  if (!job) {
    return {
      status: "idle",
      startedAt: null,
      finishedAt: null,
      error: null,
      awaitingReview: false,
      urls: [],
      profileComplete,
      missingProfile,
      everFetched,
      scrape,
      links: allowance,
    };
  }

  const stale = isStale(job);
  const urls = job.urls ?? [];
  const awaitingReview = !stale && job.status === "done" && urls.length > 0 && !job.reviewedAt;

  return {
    status: stale ? "failed" : job.status,
    startedAt: new Date(job.startedAt).toISOString(),
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
    error: stale ? "Link search timed out. Please try again." : (job.error ?? null),
    awaitingReview,
    urls: awaitingReview ? urls : [],
    profileComplete,
    missingProfile,
    everFetched,
    scrape,
    links: allowance,
  };
}

// Claims a new run for the user. Atomic, so two saves/taps can't start two
// runs — returns started: false if one is already in progress. The caller
// then runs runLinkFetch(…, startedAt) in the background (after()).
export async function startLinkFetch(
  db: Db,
  userId: ObjectId,
): Promise<{ started: true; startedAt: Date } | { started: false }> {
  const startedAt = new Date();
  const result = await db.collection("users").updateOne(
    {
      _id: userId,
      $or: [
        { "linkFetch.status": { $ne: "running" } },
        { "linkFetch.startedAt": { $lt: new Date(Date.now() - STALE_JOB_MS) } },
      ],
    },
    {
      $set: {
        linkFetch: {
          status: "running",
          startedAt,
          finishedAt: null,
          urls: [],
          error: null,
          reviewedAt: null,
        } satisfies LinkFetchJob,
      },
    },
  );
  return result.modifiedCount > 0 ? { started: true, startedAt } : { started: false };
}

// Calls the CV service and records the outcome on the job. The service
// writes what it finds into the fetchUrl collection itself (links[] with
// status "pending"); the URLs it returns for this call are what the user
// reviews on Confirm Links.
export async function runLinkFetch(
  db: Db,
  userId: ObjectId,
  startedAt: Date,
): Promise<void> {
  // Only touch the job this run claimed, in case a stale one was replaced.
  const thisJob = { _id: userId, "linkFetch.startedAt": startedAt };
  const fail = async (error: string) => {
    await db.collection("users").updateOne(thisJob, {
      $set: {
        "linkFetch.status": "failed",
        "linkFetch.error": error,
        "linkFetch.finishedAt": new Date(),
      },
    });
  };

  // Only ask for what still fits — links the user already has (typed in
  // or kept earlier) count against the plan limit.
  const { room } = await getLinkAllowance(db, userId);
  if (room <= 0) {
    return fail("You've reached your link limit. Remove a link or upgrade to add more.");
  }
  const result = await callCvApi("/api/v1/fetch-url/fetch", {
    userId: userId.toString(),
    numberOfRequests: room,
  });
  if (!result.ok) {
    return fail(
      result.reason === "not-configured"
        ? "Link discovery is not configured. Please try again later."
        : "Couldn't search for links right now. Please try again.",
    );
  }
  const json = result.json as { urls?: unknown } | null;

  const urls: string[] = Array.isArray(json?.urls)
    ? json.urls.filter((url: unknown): url is string => typeof url === "string")
    : [];

  const now = new Date();
  await db.collection("users").updateOne(thisJob, [
    {
      $set: {
        "linkFetch.status": "done",
        "linkFetch.urls": urls,
        "linkFetch.finishedAt": now,
        lastScanTriggeredAt: now,
        // Only the first success — this is what shouldAutoFetchLinks checks.
        initialLinkFetchAt: { $ifNull: ["$initialLinkFetchAt", now] },
      },
    },
  ]);
}

// Confirm Links: of this run's links, keep the chosen ones and dismiss the
// rest, then close the review. Only URLs from the run itself are touched —
// the client can't approve or reject arbitrary links.
export async function reviewLinkFetch(
  db: Db,
  userId: ObjectId,
  keepInput: string[],
): Promise<
  { ok: true; approved: number; rejected: number; kept: string[] } | { ok: false; error: string }
> {
  const status = await getLinkFetchStatus(db, userId);
  if (!status.awaitingReview) {
    return { ok: false, error: "There are no links waiting for review." };
  }

  const keep = status.urls.filter((url) => keepInput.includes(url));
  const dismiss = status.urls.filter((url) => !keep.includes(url));

  const { room, limit } = await getLinkAllowance(db, userId);
  if (keep.length > room) {
    return {
      ok: false,
      error:
        room === 0
          ? `You've reached your limit of ${limit} links.`
          : `You can keep ${room} more link${room === 1 ? "" : "s"} (limit ${limit}).`,
    };
  }

  await db.collection<FetchUrlDoc>(FETCH_URL_COLLECTION).updateOne(
    { userId },
    {
      $set: {
        "links.$[kept].status": LINK_STATUS.APPROVED,
        "links.$[dismissed].status": LINK_STATUS.REJECTED,
      },
    },
    {
      arrayFilters: [
        { "kept.url": { $in: keep } },
        { "dismissed.url": { $in: dismiss } },
      ],
    },
  );

  await db
    .collection("users")
    .updateOne({ _id: userId }, { $set: { "linkFetch.reviewedAt": new Date() } });

  return { ok: true, approved: keep.length, rejected: dismiss.length, kept: keep };
}

// How long the start call may take — the CV API answers "started" in about
// a second, so this only guards against it hanging.
const SCRAPE_START_TIMEOUT_MS = 30_000;

// A link whose scrapeStatus hasn't moved for this long counts as failed,
// so a lost CV worker can't leave the loader spinning forever.
const SCRAPE_LINK_STALL_MS = 2 * 60 * 60 * 1000;

const FINISHED_SCRAPE_STATUSES = new Set(["complete", "failed"]);

type RunLink = { uuid: string; scrapeStatus?: string; scrapeUpdatedAt?: Date };

// The run's links as they stand in fetchUrl (CV-owned scrapeStatus).
async function readRunLinks(db: Db, userId: ObjectId, job: ScrapeJob): Promise<RunLink[]> {
  const doc = await db
    .collection<{ links?: RunLink[] }>(FETCH_URL_COLLECTION)
    .findOne({ userId }, { projection: { "links.uuid": 1, "links.scrapeStatus": 1, "links.scrapeUpdatedAt": 1 } });
  const uuids = new Set(job.links.map((link) => link.uuid));
  return (doc?.links ?? []).filter((link) => uuids.has(link.uuid));
}

function summarizeRun(job: ScrapeJob, runLinks: RunLink[]) {
  const byUuid = new Map(runLinks.map((link) => [link.uuid, link]));
  const stallCutoff = Date.now() - SCRAPE_LINK_STALL_MS;
  let finished = 0;
  let failed = 0;
  for (const { uuid } of job.links) {
    const link = byUuid.get(uuid);
    const status = link?.scrapeStatus;
    const lastMoved = new Date(link?.scrapeUpdatedAt ?? job.startedAt).getTime();
    if (status === "failed" || (!FINISHED_SCRAPE_STATUSES.has(status ?? "") && lastMoved < stallCutoff)) {
      finished += 1;
      failed += 1;
    } else if (status === "complete") {
      finished += 1;
    }
  }
  const total = job.links.length;
  return { total, finished, failed, allDone: total > 0 && finished === total };
}

// Posts the CV API saved for this run's links since it started (each
// scraped post carries scrapedAt; already-saved posts are skipped by them).
async function countPostsSavedSince(db: Db, userId: ObjectId, job: ScrapeJob): Promise<number> {
  const doc = await db
    .collection<{ scrapingResults?: { uuid?: string; url?: string; scrapedAt?: string | Date }[] }>(
      "scrapingUrl",
    )
    .findOne({ userId }, { projection: { "scrapingResults.uuid": 1, "scrapingResults.url": 1, "scrapingResults.scrapedAt": 1 } });
  const runUuids = new Set(job.links.map((link) => link.uuid));
  const since = new Date(job.startedAt).getTime();
  const fresh = new Set(
    (doc?.scrapingResults ?? [])
      .filter(
        (post) =>
          post.uuid &&
          runUuids.has(post.uuid) &&
          post.scrapedAt &&
          new Date(post.scrapedAt).getTime() >= since,
      )
      .map((post) => post.url),
  );
  return fresh.size;
}

// Closes the run once every queued link has finished: marks it done and
// sends the "new posts found" alert (once per run, only if there are any). Called by the
// callback route and by status reads, so a lost callback still finishes the
// run the next time anyone looks.
export async function finalizeScrapeIfDone(db: Db, userId: ObjectId): Promise<boolean> {
  const user = await db
    .collection<{ scrapeJob?: ScrapeJob }>("users")
    .findOne({ _id: userId }, { projection: { scrapeJob: 1 } });
  const job = user?.scrapeJob;
  if (!job || job.status !== "running" || job.links.length === 0) return false;

  const summary = summarizeRun(job, await readRunLinks(db, userId, job));
  if (!summary.allDone) return false;

  const allFailed = summary.failed === summary.total;
  const closed = await db.collection("users").updateOne(
    { _id: userId, "scrapeJob.startedAt": job.startedAt, "scrapeJob.status": "running" },
    {
      $set: {
        "scrapeJob.status": allFailed ? "failed" : "done",
        "scrapeJob.finishedAt": new Date(),
        "scrapeJob.error": allFailed ? "None of your links could be scraped. Please try again." : null,
      },
    },
  );
  // Only the call that actually closed the run sends the alert (and the
  // alert's dedupeKey covers any race on top of that).
  if (closed.modifiedCount > 0) {
    // Alert only when it matters: new posts were found, or a scrape the
    // user started failed outright. Nothing new = no alert, so scheduled
    // re-scrapes don't ping paid users every 2 days for nothing.
    const newPosts = await countPostsSavedSince(db, userId, job);
    if (newPosts > 0 || (allFailed && job.trigger !== "scheduled")) {
      await notifyScrapeComplete(db, {
        userId,
        runStartedAt: new Date(job.startedAt),
        newPosts,
        failed: newPosts === 0 && allFailed,
      });
    }
    // Links added while this run was going (e.g. typed into Known
    // Websites) get their own run now.
    await startPendingScrape(db, userId).catch((error) =>
      console.error("Follow-up scrape failed to start:", error),
    );
  }
  return closed.modifiedCount > 0;
}

export async function getScrapeStatus(
  db: Db,
  userId: ObjectId,
  job: ScrapeJob | undefined,
  // fetchUrl.links if the caller already loaded them (saves a read).
  preloadedLinks?: RunLink[],
): Promise<ScrapeStatus> {
  if (!job) {
    return {
      status: "idle",
      startedAt: null,
      finishedAt: null,
      error: null,
      linkCount: 0,
      finishedCount: 0,
      failedCount: 0,
    };
  }

  let current = job;
  let summary = { total: job.links.length, finished: 0, failed: 0, allDone: false };
  if (job.links.length > 0) {
    const runLinks = preloadedLinks
      ? preloadedLinks.filter((link) => job.links.some((queued) => queued.uuid === link.uuid))
      : await readRunLinks(db, userId, job);
    summary = summarizeRun(job, runLinks);
    // Fallback for a missed final callback: finish the run on read.
    if (job.status === "running" && summary.allDone && (await finalizeScrapeIfDone(db, userId))) {
      const refreshed = await db
        .collection<{ scrapeJob?: ScrapeJob }>("users")
        .findOne({ _id: userId }, { projection: { scrapeJob: 1 } });
      current = refreshed?.scrapeJob ?? job;
    }
  }

  return {
    status: current.status,
    startedAt: new Date(current.startedAt).toISOString(),
    finishedAt: current.finishedAt ? new Date(current.finishedAt).toISOString() : null,
    error: current.error ?? null,
    linkCount: summary.total,
    finishedCount: summary.finished,
    failedCount: summary.failed,
  };
}

// Starts a scrape over `urls` (approved links from the user's fetchUrl):
// claims the run (one per user at a time), asks the CV API to start, and
// records the links it queued. Returns quickly — scraping itself happens on
// the CV side and is followed through callbacks + fetchUrl.
export async function startScrapeRun(
  db: Db,
  userId: ObjectId,
  urls: string[],
  trigger: ScrapeJob["trigger"] = "user",
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  // Only links the user still watches are ever sent — whatever the caller
  // passed (an old Try Again list, a race with a removal). The CV API itself
  // doesn't check approval, only that the link exists in fetchUrl.
  const watched = new Set((await getApprovedLinks(db, userId)).map((link) => watchedLinkKey(link.url)));
  urls = urls.filter((url) => watched.has(watchedLinkKey(url)));
  if (urls.length === 0) {
    return { ok: false, status: 400, error: "There are no links to scrape." };
  }

  // Never call the CV API for an incomplete profile.
  const completeness = await getProfileCompleteness(db, userId);
  if (!completeness.complete) {
    return {
      ok: false,
      status: 400,
      error: "Complete your identity profile and reference media before scraping.",
    };
  }

  const startedAt = new Date();
  const claim = await db.collection("users").updateOne(
    {
      _id: userId,
      $or: [
        { "scrapeJob.status": { $ne: "running" } },
        // A run nobody heard from in a long time doesn't block a new one.
        { "scrapeJob.startedAt": { $lt: new Date(Date.now() - SCRAPE_LINK_STALL_MS) } },
      ],
    },
    {
      $set: {
        scrapeJob: {
          status: "running",
          startedAt,
          finishedAt: null,
          links: [],
          requestedUrls: urls,
          error: null,
          trigger,
        } satisfies ScrapeJob,
      },
    },
  );
  if (claim.modifiedCount === 0) {
    return { ok: false, status: 409, error: "Scraping is already in progress." };
  }

  const thisJob = { _id: userId, "scrapeJob.startedAt": startedAt };
  const fail = async (status: number, error: string) => {
    await db.collection("users").updateOne(thisJob, {
      $set: { "scrapeJob.status": "failed", "scrapeJob.error": error, "scrapeJob.finishedAt": new Date() },
    });
    return { ok: false as const, status, error };
  };

  const [profile, faces, plan] = await Promise.all([
    db
      .collection<{ fullName?: string }>(IDENTITY_PROFILES_COLLECTION)
      .findOne({ userId }, { projection: { fullName: 1 } }),
    db
      .collection<{ imageUrl: string; position?: number }>("referenceMedia")
      .find({ userId, status: "active", verificationStatus: "verified" })
      .project<{ imageUrl: string; position?: number }>({ imageUrl: 1, position: 1 })
      .sort({ position: 1 })
      .limit(3)
      .toArray(),
    resolveUserPlan(db, userId),
  ]);

  const body: Record<string, unknown> = {
    userId: userId.toString(),
    name: profile?.fullName?.trim() || "",
    numberOfDays: PLAN_LIMITS[plan].scrapeDays,
    links: urls,
  };
  // face1-3 by position — same as the verification call.
  faces.forEach((face, index) => {
    body[`face${face.position ?? index + 1}`] = face.imageUrl;
  });

  const result = await callCvApi("/api/v1/scraping/scrape", body, SCRAPE_START_TIMEOUT_MS);
  if (!result.ok) {
    if (result.reason === "not-configured") {
      return fail(502, "Scraping is not configured. Please try again later.");
    }
    if (result.status === 404) {
      return fail(400, "None of these links could be found for scraping.");
    }
    return fail(502, "Couldn't start scraping right now. Please try again.");
  }

  const json = result.json as { queuedLinks?: unknown } | null;
  const queued = Array.isArray(json?.queuedLinks)
    ? (json.queuedLinks as { uuid?: unknown; url?: unknown }[])
        .filter((link) => typeof link?.uuid === "string" && typeof link?.url === "string")
        .map((link) => ({ uuid: link.uuid as string, url: link.url as string }))
    : [];
  if (queued.length === 0) {
    return fail(400, "None of these links could be found for scraping.");
  }

  await db.collection("users").updateOne(thisJob, [
    {
      $set: {
        "scrapeJob.links": queued,
        // Decides when links typed into Known Websites get scraped: with
        // the first scrape, or straight after saving once it has run.
        firstScrapeAt: { $ifNull: ["$firstScrapeAt", "$$NOW"] },
      },
    },
  ]);
  return { ok: true };
}

// Approved links that have never been scraped (typed in, or kept on
// Confirm Links but not scraped yet).
export async function getUnscrapedApprovedUrls(db: Db, userId: ObjectId): Promise<string[]> {
  const approved = await getApprovedLinks(db, userId);
  return approved
    .filter((link) => !link.scrapeStatus || link.scrapeStatus === "pending")
    .map((link) => link.url);
}

// Scrapes every approved link not scraped yet. No-op when there's nothing
// to scrape; refused (409) if a run is already going — finalizeScrapeIfDone
// picks the rest up when that run ends.
export async function startPendingScrape(
  db: Db,
  userId: ObjectId,
): Promise<{ ok: true; started: boolean } | { ok: false; status: number; error: string }> {
  const urls = await getUnscrapedApprovedUrls(db, userId);
  if (urls.length === 0) return { ok: true, started: false };
  const result = await startScrapeRun(db, userId, urls);
  return result.ok ? { ok: true, started: true } : result;
}

// ---- Scheduled re-scrapes (paid plans) -----------------------------------
// Every PLAN_LIMITS.autoScrapeEveryDays after the last scrape started, all
// of a user's watched links are scraped again (the CV API skips posts it
// already saved). Driven by app/api/cron/scheduled-scrape.

// Paid users whose last scrape started at least `everyDays` ago and isn't
// still running, oldest first. Users who never had a scrape are left to the
// normal flow (Confirm Links / Known Websites).
export async function findUsersDueForScheduledScrape(
  db: Db,
  plan: string,
  everyDays: number,
  limit: number,
): Promise<ObjectId[]> {
  const dueBefore = new Date(Date.now() - everyDays * 24 * 60 * 60 * 1000);
  const users = await db
    .collection("users")
    .find(
      {
        plan,
        "scrapeJob.startedAt": { $lte: dueBefore },
        "scrapeJob.status": { $ne: "running" },
      },
      { projection: { _id: 1 } },
    )
    .sort({ "scrapeJob.startedAt": 1 })
    .limit(limit)
    .toArray();
  return users.map((user) => user._id as ObjectId);
}

// Re-scrapes every watched link of one user, if their plan includes it.
export async function startScheduledScrape(
  db: Db,
  userId: ObjectId,
): Promise<{ started: boolean; reason?: string }> {
  // Re-check the plan (users.plan can lag an expired subscription).
  const plan = await resolveUserPlan(db, userId);
  if (!PLAN_LIMITS[plan].autoScrapeEveryDays) {
    return { started: false, reason: "plan" };
  }
  const urls = (await getApprovedLinks(db, userId)).map((link) => link.url);
  if (urls.length === 0) return { started: false, reason: "no-links" };

  const result = await startScrapeRun(db, userId, urls, "scheduled");
  return result.ok ? { started: true } : { started: false, reason: result.error };
}

// ---- Manual scan (dashboard Scan button) -------------------------------
// Plans with PLAN_LIMITS.manualScans get that many re-scrapes of all their
// watched links, ever, unlocked MANUAL_SCAN_UNLOCK_DAYS after their first
// scrape. Plans without (Cloak Pro re-scrapes automatically) get no button.

export type ManualScanState = {
  // Plan includes a Scan button at all.
  offered: boolean;
  available: boolean;
  // When it unlocks (first scrape + MANUAL_SCAN_UNLOCK_DAYS); null before
  // the first scrape.
  availableAt: string | null;
  used: number;
  allowed: number;
  // Why it's disabled, for the button's hint.
  reason: "plan" | "no-first-scrape" | "too-early" | "used" | "running" | null;
};

// Testing aid: DEV_MANUAL_SCAN=true shows the Scan button on every plan,
// with no 2-day wait and no limit. Ignored in production builds, so it can
// never give real users unlimited scans.
function devManualScanEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_MANUAL_SCAN === "true";
}

export async function getManualScanState(db: Db, userId: ObjectId): Promise<ManualScanState> {
  const [plan, user] = await Promise.all([
    resolveUserPlan(db, userId),
    db
      .collection<{ firstScrapeAt?: Date; manualScansUsed?: number; scrapeJob?: ScrapeJob }>("users")
      .findOne(
        { _id: userId },
        { projection: { firstScrapeAt: 1, manualScansUsed: 1, "scrapeJob.status": 1 } },
      ),
  ]);
  const used = user?.manualScansUsed ?? 0;

  if (devManualScanEnabled()) {
    const running = user?.scrapeJob?.status === "running";
    return {
      offered: true,
      available: !running,
      availableAt: null,
      used,
      allowed: Number.MAX_SAFE_INTEGER,
      reason: running ? "running" : null,
    };
  }

  const allowed = PLAN_LIMITS[plan].manualScans;
  const availableAt = user?.firstScrapeAt
    ? new Date(
        new Date(user.firstScrapeAt).getTime() + MANUAL_SCAN_UNLOCK_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString()
    : null;

  const reason: ManualScanState["reason"] =
    allowed === 0
      ? "plan"
      : used >= allowed
        ? "used"
        : !availableAt
          ? "no-first-scrape"
          : Date.now() < new Date(availableAt).getTime()
            ? "too-early"
            : user?.scrapeJob?.status === "running"
              ? "running"
              : null;

  return { offered: allowed > 0, available: reason === null, availableAt, used, allowed, reason };
}

// Uses one manual scan and re-scrapes every watched link. The scan is only
// counted if the scrape actually starts.
export async function startManualScan(
  db: Db,
  userId: ObjectId,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const state = await getManualScanState(db, userId);
  if (!state.available) {
    const error =
      state.reason === "plan"
        ? "Your plan scans automatically every few days."
        : state.reason === "used"
          ? "You've already used your manual scan. Upgrade to Cloak Pro for automatic scans."
          : state.reason === "running"
            ? "A scan is already in progress."
            : "Your manual scan unlocks 2 days after your first scan.";
    return { ok: false, status: 400, error };
  }

  const urls = (await getApprovedLinks(db, userId)).map((link) => link.url);
  if (urls.length === 0) {
    return { ok: false, status: 400, error: "Add some links to watch first." };
  }

  // Dev override: don't count it against the plan's real allowance.
  if (devManualScanEnabled()) {
    return startScrapeRun(db, userId, urls, "manual");
  }

  // Claim one use atomically, so a double tap can't scan twice.
  const claim = await db.collection("users").updateOne(
    {
      _id: userId,
      $or: [
        { manualScansUsed: { $exists: false } },
        { manualScansUsed: { $lt: state.allowed } },
      ],
    },
    { $inc: { manualScansUsed: 1 } },
  );
  if (claim.modifiedCount === 0) {
    return { ok: false, status: 400, error: "You've already used your manual scan." };
  }

  const result = await startScrapeRun(db, userId, urls, "manual");
  if (!result.ok) {
    // Didn't start — give the scan back.
    await db.collection("users").updateOne({ _id: userId }, { $inc: { manualScansUsed: -1 } });
    return result;
  }
  return { ok: true };
}

export async function hasFirstScrapeRun(db: Db, userId: ObjectId): Promise<boolean> {
  const user = await db
    .collection("users")
    .findOne({ _id: userId }, { projection: { firstScrapeAt: 1 } });
  return Boolean(user?.firstScrapeAt);
}

// "Try Again": re-sends the last run's links — but only those the user
// still watches (a link removed since then must not be scraped again).
export async function getLastScrapeUrls(db: Db, userId: ObjectId): Promise<string[]> {
  const [user, approved] = await Promise.all([
    db
      .collection<{ scrapeJob?: ScrapeJob }>("users")
      .findOne({ _id: userId }, { projection: { scrapeJob: 1 } }),
    getApprovedLinks(db, userId),
  ]);
  const job = user?.scrapeJob;
  const lastUrls = job?.requestedUrls?.length
    ? job.requestedUrls
    : // Runs from before the async scrape stored plain URLs in `links`.
      (job?.links ?? [])
        .map((link: unknown) => (typeof link === "string" ? link : (link as { url?: string })?.url))
        .filter((url): url is string => typeof url === "string");

  const stillWatched = new Set(approved.map((link) => watchedLinkKey(link.url)));
  return lastUrls.filter((url) => stillWatched.has(watchedLinkKey(url)));
}

// Whether a callback's link belongs to the user's current run. Callbacks
// for anything else (an older run, an unknown link) are ignored.
export async function isLinkInCurrentScrape(
  db: Db,
  userId: ObjectId,
  linkUuid: string,
): Promise<boolean> {
  const user = await db
    .collection("users")
    .findOne({ _id: userId, "scrapeJob.links.uuid": linkUuid }, { projection: { _id: 1 } });
  return Boolean(user);
}

// Links to show in Cloak Watch / count on the dashboard: the user's watched
// (approved) links. Falls back to the legacy flat `urls` array for
// fetchUrl docs written before the service switched to links[].
export function getActiveLinkUrls(doc: FetchUrlDoc | null): string[] {
  if (!doc) return [];
  if (Array.isArray(doc.links)) {
    return doc.links
      .filter((link) => link?.url && link.status === LINK_STATUS.APPROVED)
      .map((link) => link.url);
  }
  return Array.isArray(doc.urls) ? doc.urls : [];
}
