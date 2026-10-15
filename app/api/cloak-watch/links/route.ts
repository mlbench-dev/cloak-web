import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getCloakWatchOverview } from "@/lib/cloakWatchPosts";
import {
  getApprovedLinks,
  getLinkFetchStatus,
  getProfileCompleteness,
  hasFirstScrapeRun,
  startPendingScrape,
} from "@/lib/fetchLinks";
import { setWatchedLinks } from "@/lib/watchedLinks";

// GET — Cloak Watch's main list: watched links with their scrape progress
// and new-post counts, plus the stats card.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = await getDb();
    const overview = await getCloakWatchOverview(db, new ObjectId(session.user.id));
    return NextResponse.json({ success: true, ...overview });
  } catch (error) {
    console.error("Error loading Cloak Watch overview:", error);
    return NextResponse.json({ error: "Couldn't load Cloak Watch." }, { status: 500 });
  }
}

// POST { url } — "Add Link": adds one watched link under the same rules as
// Known Websites (Instagram/Facebook/X only, plan limit), then scrapes it
// the same way: with the first scrape if that hasn't run, otherwise now.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "Enter a link." }, { status: 400 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    const current = (await getApprovedLinks(db, userId)).map((link) => link.url);
    const result = await setWatchedLinks(db, userId, [...current, url]);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.added === 0) {
      return NextResponse.json({ error: "That link is already in Cloak Watch." }, { status: 400 });
    }

    // Scrape it now — unless a link search or review is still underway, in
    // which case it's included in the scrape that review starts. (Waiting
    // for "the first scrape" alone would strand it if the user dismissed
    // every suggestion and so never had one.)
    let scrapeStarted = false;
    if ((await getProfileCompleteness(db, userId)).complete) {
      const status = await getLinkFetchStatus(db, userId);
      const reviewPending = status.status === "running" || status.awaitingReview;
      if ((await hasFirstScrapeRun(db, userId)) || !reviewPending) {
        const scrape = await startPendingScrape(db, userId);
        scrapeStarted = scrape.ok && scrape.started;
      }
    }

    return NextResponse.json({ success: true, scrapeStarted });
  } catch (error) {
    console.error("Error adding Cloak Watch link:", error);
    return NextResponse.json({ error: "Couldn't add the link." }, { status: 500 });
  }
}
