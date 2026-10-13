import { after, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  FETCH_URL_COLLECTION,
  LINK_STATUS,
  getLinkFetchStatus,
  getProfileCompleteness,
  reviewLinkFetch,
  runLinkFetch,
  runScrape,
  startLinkFetch,
  startScrape,
  type FetchUrlDoc,
} from "@/lib/fetchLinks";

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
// rest of that run's links are dismissed. Then scraping starts in the
// background on the kept links — the client follows it via GET.
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

    const claim = await startScrape(db, userId, result.kept);
    if (claim.started) {
      after(() =>
        runScrape(db, userId, claim.startedAt).catch((error) =>
          console.error("Scrape job crashed:", error),
        ),
      );
    }

    const status = await getLinkFetchStatus(db, userId);
    return NextResponse.json({
      success: true,
      ...status,
      approved: result.approved,
      rejected: result.rejected,
      scrapeStarted: claim.started,
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

    const doc = await collection.findOne(
      { userId },
      { projection: { links: 1 } },
    );

    const result = Array.isArray(doc?.links)
      ? await collection.updateOne(
          { userId },
          { $set: { "links.$[removed].status": LINK_STATUS.REJECTED } },
          { arrayFilters: [{ "removed.url": { $in: urls } }] },
        )
      : // Legacy docs from before the service switched to links[].
        await collection.updateOne({ userId }, { $pull: { urls: { $in: urls } } });

    return NextResponse.json({
      success: true,
      deletedCount: result.modifiedCount > 0 ? urls.length : 0,
    });
  } catch (error) {
    console.error("Error deleting watched links:", error);
    return NextResponse.json(
      { error: "Failed to delete selected links." },
      { status: 500 },
    );
  }
}
