import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  getLastScrapeUrls,
  getLinkFetchStatus,
  startPendingScrape,
  startScrapeRun,
} from "@/lib/fetchLinks";

// "Try Again" on the scraping loader: re-sends the last run's links.
// With { pending: true } ("Check my links now" on Cloak Watch) it scrapes
// the watched links that have never been scraped instead.
// Normally scraping starts from Confirm Links (PATCH /api/fetch-urls).
// Progress is read from GET /api/fetch-urls.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    const body = await request.json().catch(() => null);
    if (body?.pending === true) {
      const pending = await startPendingScrape(db, userId);
      if (!pending.ok) {
        return NextResponse.json({ error: pending.error }, { status: pending.status });
      }
      if (!pending.started) {
        return NextResponse.json(
          { error: "All your links have already been checked." },
          { status: 400 },
        );
      }
    } else {
      const result = await startScrapeRun(db, userId, await getLastScrapeUrls(db, userId));
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
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
