import http from "node:http";
import https from "node:https";
import type { Db, ObjectId } from "mongodb";
import { PLAN_LIMITS } from "@/lib/config";
import { resolveUserPlan } from "@/lib/planLimits";

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
): Promise<{ ok: true; json: unknown } | { ok: false; reason: "not-configured" | "unreachable" | "error" }> {
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
    response = await postJson(`${base}${path}`, body, headers, CV_API_TIMEOUT_MS);
  } catch (error) {
    console.error(`CV API ${path}: could not reach the service in time:`, error);
    return { ok: false, reason: "unreachable" };
  }

  if (response.status < 200 || response.status >= 300) {
    console.error(`CV API ${path}: service returned an error:`, response.status, response.json);
    return { ok: false, reason: "error" };
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
  const user = await db
    .collection("users")
    .findOne({ _id: userId }, { projection: { initialLinkFetchAt: 1 } });
  return !user?.initialLinkFetchAt;
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
  // Post scraping on the links the user kept (see startScrape).
  scrape: ScrapeStatus;
};

// One scraping run over the links the user kept on Confirm Links, stored on
// the user doc as `scrapeJob` — same background-job pattern as linkFetch.
export type ScrapeJob = {
  status: "running" | "done" | "failed";
  startedAt: Date;
  finishedAt?: Date | null;
  links: string[];
  error?: string | null;
};

export type ScrapeStatus = {
  status: "idle" | "running" | "done" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  linkCount: number;
};

function toScrapeStatus(job: ScrapeJob | undefined): ScrapeStatus {
  if (!job) {
    return { status: "idle", startedAt: null, finishedAt: null, error: null, linkCount: 0 };
  }
  const stale = isStale(job);
  return {
    status: stale ? "failed" : job.status,
    startedAt: new Date(job.startedAt).toISOString(),
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
    error: stale ? "Scraping timed out. Please try again." : (job.error ?? null),
    linkCount: job.links?.length ?? 0,
  };
}

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
  const [user, completeness] = await Promise.all([
    db
      .collection<{ linkFetch?: LinkFetchJob; scrapeJob?: ScrapeJob; initialLinkFetchAt?: Date }>(
        "users",
      )
      .findOne(
        { _id: userId },
        { projection: { linkFetch: 1, scrapeJob: 1, initialLinkFetchAt: 1 } },
      ),
    getProfileCompleteness(db, userId),
  ]);
  const job = user?.linkFetch;
  const profileComplete = completeness.complete;
  const missingProfile = completeness.missing;
  const everFetched = Boolean(user?.initialLinkFetchAt);
  const scrape = toScrapeStatus(user?.scrapeJob);

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

  const plan = await resolveUserPlan(db, userId);
  const result = await callCvApi("/api/v1/fetch-url/fetch", {
    userId: userId.toString(),
    numberOfRequests: PLAN_LIMITS[plan].linksPerFetch,
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

// Claims a scraping run over `links` (atomic, one at a time per user). The
// caller then runs runScrape(…, startedAt) in the background (after()).
export async function startScrape(
  db: Db,
  userId: ObjectId,
  links: string[],
): Promise<{ started: true; startedAt: Date } | { started: false }> {
  if (links.length === 0) return { started: false };
  const startedAt = new Date();
  const result = await db.collection("users").updateOne(
    {
      _id: userId,
      $or: [
        { "scrapeJob.status": { $ne: "running" } },
        { "scrapeJob.startedAt": { $lt: new Date(Date.now() - STALE_JOB_MS) } },
      ],
    },
    {
      $set: {
        scrapeJob: {
          status: "running",
          startedAt,
          finishedAt: null,
          links,
          error: null,
        } satisfies ScrapeJob,
      },
    },
  );
  return result.modifiedCount > 0 ? { started: true, startedAt } : { started: false };
}

// Asks the CV scraper to scan the claimed links for posts matching the
// user: their name, reference faces (face1-3, by position — same as the
// verification call) and a plan-based look-back window. The scraper
// stores its results itself; this only tracks the run.
export async function runScrape(
  db: Db,
  userId: ObjectId,
  startedAt: Date,
): Promise<void> {
  const thisJob = { _id: userId, "scrapeJob.startedAt": startedAt };
  const finish = async (update: Record<string, unknown>) => {
    await db.collection("users").updateOne(thisJob, {
      $set: { ...update, "scrapeJob.finishedAt": new Date() },
    });
  };
  const fail = (error: string) =>
    finish({ "scrapeJob.status": "failed", "scrapeJob.error": error });

  const [user, profile, faces, completeness] = await Promise.all([
    db
      .collection<{ scrapeJob?: ScrapeJob }>("users")
      .findOne(thisJob, { projection: { scrapeJob: 1 } }),
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
    getProfileCompleteness(db, userId),
  ]);

  const links = user?.scrapeJob?.links ?? [];
  if (links.length === 0) return fail("There are no links to scrape.");
  // Same gate as link discovery: never call the CV API for an incomplete
  // profile (e.g. a reference photo was replaced and isn't verified yet).
  if (!completeness.complete) {
    return fail("Complete your identity profile and reference media first.");
  }

  const plan = await resolveUserPlan(db, userId);
  const body: Record<string, unknown> = {
    userId: userId.toString(),
    name: profile?.fullName?.trim() || "",
    numberOfDays: PLAN_LIMITS[plan].scrapeDays,
    links,
  };
  faces.forEach((face, index) => {
    body[`face${face.position ?? index + 1}`] = face.imageUrl;
  });

  const result = await callCvApi("/api/v1/scraping/scrape", body);
  if (!result.ok) {
    return fail(
      result.reason === "not-configured"
        ? "Scraping is not configured. Please try again later."
        : "Couldn't scrape your links right now. Please try again.",
    );
  }

  await finish({ "scrapeJob.status": "done" });
}

// Re-runs the last scrape (its "Try Again").
export async function getLastScrapeLinks(db: Db, userId: ObjectId): Promise<string[]> {
  const user = await db
    .collection<{ scrapeJob?: ScrapeJob }>("users")
    .findOne({ _id: userId }, { projection: { scrapeJob: 1 } });
  return user?.scrapeJob?.links ?? [];
}

// Links to show in Cloak Watch / count on the dashboard: everything the
// user hasn't dismissed. Falls back to the legacy flat `urls` array for
// fetchUrl docs written before the service switched to links[].
export function getActiveLinkUrls(doc: FetchUrlDoc | null): string[] {
  if (!doc) return [];
  if (Array.isArray(doc.links)) {
    return doc.links
      .filter((link) => link?.url && link.status !== LINK_STATUS.REJECTED)
      .map((link) => link.url);
  }
  return Array.isArray(doc.urls) ? doc.urls : [];
}
