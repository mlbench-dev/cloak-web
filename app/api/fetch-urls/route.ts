import { after, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  FETCH_URL_COLLECTION,
  getLinkAllowance,
  getLinkFetchStatus,
  getProfileCompleteness,
  reviewLinkFetch,
  runLinkFetch,
  startLinkFetch,
  startPendingScrape,
  type FetchUrlDoc,
} from "@/lib/fetchLinks";
import { removeWatchedLinks } from "@/lib/watchedLinks";

// The CV call runs in after() below, which gets this route's max duration.
// FETCH_URL_TIMEOUT_MS in lib/fetchLinks.ts aborts just before it.
export const maxDuration = 600;

function readUrlList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((url): url is string => typeof url === "string")
    : [];
}

// Current link-discovery job for the signed-in user — polled by the
// Scraping Links screen wherever it's shown (identity profile, Cloak
// Watch, dashboard).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const status = await getLinkFetchStatus(db, new ObjectId(session.user.id));
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error("Error reading link fetch status:", error);
    return NextResponse.json(
      { error: "Couldn't load scan status." },
      { status: 500 },
    );
  }
}

// Starts link discovery in the background and returns straight away; the
// client polls GET for progress. If a run is already going, this just
// returns its status instead of starting another. The browser only ever
// talks to this route — the CV service is called server-side.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    // The CV API is never called for an incomplete profile — enforced
    // here, not just in the UI, so a direct POST can't skip it.
    const { complete } = await getProfileCompleteness(db, userId);
    if (!complete) {
      return NextResponse.json(
        { error: "Complete your identity profile and reference media before scanning." },
        { status: 400 },
      );
    }

    // Typed-in and kept links count against the plan limit.
    const allowance = await getLinkAllowance(db, userId);
    if (allowance.room <= 0) {
      return NextResponse.json(
        {
          error:
            allowance.changesPerWindow > 0
              ? `You've reached your limit of ${allowance.limit} links. Remove a link to make room for new ones.`
              : `You've reached your limit of ${allowance.limit} links. Upgrade to Cloak Pro for up to 20.`,
        },
        { status: 400 },
      );
    }

    const claim = await startLinkFetch(db, userId);
    if (claim.started) {
      after(() =>
        runLinkFetch(db, userId, claim.startedAt).catch((error) =>
          console.error("Link fetch job crashed:", error),
        ),
      );
    }

    const status = await getLinkFetchStatus(db, userId);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error("Error starting link fetch:", error);
    return NextResponse.json(
      { error: "Scan request failed. Please try again." },
      { status: 500 },
    );
  }
}

// Confirm Links: `keep` lists the URLs (from the latest run) to keep; the
// rest of that run's links are dismissed. Then scraping starts on the kept
// links — the CV API answers "started" right away and reports progress
// through /api/scrape/callback; the client follows it via GET.
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const db = await getDb();
    const userId = new ObjectId(session.user.id);
    const result = await reviewLinkFetch(db, userId, readUrlList(body?.keep));

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Scrapes the links just kept plus any typed-in links not scraped yet
    // (they wait for the first scrape). A failed start is recorded on the
    // scrape job, so the loader shows it with Try Again; the review itself
    // is already saved either way.
    const scrape = await startPendingScrape(db, userId);

    const status = await getLinkFetchStatus(db, userId);
    return NextResponse.json({
      success: true,
      ...status,
      approved: result.approved,
      rejected: result.rejected,
      scrapeStarted: scrape.ok && scrape.started,
    });
  } catch (error) {
    console.error("Error confirming links:", error);
    return NextResponse.json(
      { error: "Couldn't save your selection. Please try again." },
      { status: 500 },
    );
  }
}

// Removes one or more links from the user's watch list (Cloak Watch's
// select-and-delete mode). Marked rejected rather than deleted, so the
// same link isn't offered again as new on the next fetch.
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const urls = readUrlList(body?.urls);

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "No links provided to delete." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);
    const collection = db.collection<FetchUrlDoc>(FETCH_URL_COLLECTION);

    // Legacy docs from before the service switched to links[] have no
    // plan rules to apply — just drop the URLs.
    const doc = await collection.findOne({ userId }, { projection: { links: 1 } });
    if (!Array.isArray(doc?.links)) {
      const legacy = await collection.updateOne({ userId }, { $pull: { urls: { $in: urls } } });
      return NextResponse.json({
        success: true,
        deletedCount: legacy.modifiedCount > 0 ? urls.length : 0,
      });
    }

    // Same rules as Known Websites: Freemium can't remove saved links,
    // Cloak Pro can change a limited number per period.
    const result = await removeWatchedLinks(db, userId, urls);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, deletedCount: result.removed });
  } catch (error) {
    console.error("Error deleting watched links:", error);
    return NextResponse.json(
      { error: "Failed to delete selected links." },
      { status: 500 },
    );
  }
}
