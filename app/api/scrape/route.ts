import { after, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  getLastScrapeLinks,
  getLinkFetchStatus,
  getProfileCompleteness,
  runScrape,
  startScrape,
} from "@/lib/fetchLinks";

// The CV call runs in after() below, which gets this route's max duration.
export const maxDuration = 600;

// Re-runs the last scrape over the same links ("Try Again" on the
// scraping loader). Normally scraping starts from Confirm Links (PATCH
// /api/fetch-urls). Progress is read from GET /api/fetch-urls.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    const { complete } = await getProfileCompleteness(db, userId);
    if (!complete) {
      return NextResponse.json(
        { error: "Complete your identity profile and reference media before scraping." },
        { status: 400 },
      );
    }

    const links = await getLastScrapeLinks(db, userId);
    if (links.length === 0) {
      return NextResponse.json({ error: "There are no links to scrape." }, { status: 400 });
    }

    const claim = await startScrape(db, userId, links);
    if (claim.started) {
      after(() =>
        runScrape(db, userId, claim.startedAt).catch((error) =>
          console.error("Scrape job crashed:", error),
        ),
      );
    }

    const status = await getLinkFetchStatus(db, userId);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error("Error starting scrape:", error);
    return NextResponse.json(
      { error: "Couldn't start scraping. Please try again." },
      { status: 500 },
    );
  }
}
