import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { PLAN_LIMITS } from "@/lib/config";
import { resolveUserPlan } from "@/lib/planLimits";
import {
  FETCH_URL_COLLECTION,
  getActiveLinkUrls,
  getManualScanState,
  type FetchUrlDoc,
  type ScrapeJob,
} from "@/lib/fetchLinks";

// Real numbers for the dashboard's scan card, stat tiles and activity rows.

// One post the CV scraper saved (scrapingUrl.scrapingResults).
type ScrapedPost = {
  matchinglevel?: string;
  matchingscore?: number;
  scrapedAt?: string | Date;
};

// What counts as a "match": anything the CV API didn't rate low. Their
// levels so far are "high level match" and "low level matching".
// TODO(CV team): confirm the levels and where a post stops being a match.
function isMatch(post: ScrapedPost): boolean {
  return !/^low\b/i.test(post.matchinglevel ?? "");
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    const [plan, user, scraped, pendingReports, manualScan, fetchUrlDoc] = await Promise.all([
      resolveUserPlan(db, userId),
      db
        .collection<{ scrapeJob?: ScrapeJob }>("users")
        .findOne({ _id: userId }, { projection: { scrapeJob: 1 } }),
      db
        .collection<{ scrapingResults?: ScrapedPost[]; updatedAt?: Date }>("scrapingUrl")
        .findOne(
          { userId },
          { projection: { updatedAt: 1, "scrapingResults.matchinglevel": 1, "scrapingResults.matchingscore": 1, "scrapingResults.scrapedAt": 1 } },
        ),
      // Reports other users filed against this user, still to be decided.
      db.collection("reports").countDocuments({ targetUserId: userId, status: "PENDING" }),
      // The Scan button: free plans only, once, unlocked 2 days after the
      // first scan.
      getManualScanState(db, userId),
      // URLs Detected = the user's watched links (was /api/scan-results).
      db.collection<FetchUrlDoc>(FETCH_URL_COLLECTION).findOne({ userId }, { projection: { links: 1, urls: 1 } }),
    ]);

    // Last scan = the latest scrape: when it finished (or started, if it's
    // still running) and how it ended.
    const job = user?.scrapeJob;
    const lastScan = job
      ? {
          status: job.status,
          at: new Date(
            job.status === "running" ? job.startedAt : (job.finishedAt ?? job.startedAt),
          ).toISOString(),
        }
      : // Scraped before scrape jobs were tracked.
        scraped?.updatedAt
        ? { status: "done" as const, at: new Date(scraped.updatedAt).toISOString() }
        : { status: "never" as const, at: null };

    // Paid plans re-scrape every N days after the last scrape started
    // (app/api/cron/scheduled-scrape); free plans have no schedule.
    const everyDays = PLAN_LIMITS[plan].autoScrapeEveryDays;
    const nextScanAt =
      everyDays && job?.startedAt
        ? new Date(new Date(job.startedAt).getTime() + everyDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const matches = (scraped?.scrapingResults ?? []).filter(isMatch);
    const weekAgo = Date.now() - WEEK_MS;
    const matchesThisWeek = matches.filter(
      (post) => post.scrapedAt && new Date(post.scrapedAt).getTime() >= weekAgo,
    ).length;
    const scores = matches
      .map((post) => post.matchingscore)
      .filter((score): score is number => typeof score === "number");
    const avgMatchConfidence =
      scores.length > 0
        ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100)
        : null;

    return NextResponse.json({
      success: true,
      urlCount: getActiveLinkUrls(fetchUrlDoc).length,
      lastScan,
      autoScan: Boolean(everyDays),
      nextScanAt,
      matches: matches.length,
      matchesThisWeek,
      avgMatchConfidence,
      pendingReports,
      manualScan,
    });
  } catch (error) {
    console.error("Error loading dashboard summary:", error);
    return NextResponse.json({ error: "Couldn't load your dashboard." }, { status: 500 });
  }
}
