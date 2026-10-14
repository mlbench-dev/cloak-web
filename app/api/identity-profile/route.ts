import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId, type Db } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { IdentityProfileDoc } from "@/models/IdentityProfile";
import {
  IDENTITY_PROFILES_COLLECTION,
  getApprovedLinks,
  getLinkAllowance,
  getProfileCompleteness,
  hasFirstScrapeRun,
  shouldAutoFetchLinks,
  startPendingScrape,
} from "@/lib/fetchLinks";
import { setWatchedLinks } from "@/lib/watchedLinks";

// Known Websites = the user's watched links (fetchUrl.links, approved):
// typed in here or kept on Confirm Links. Returned with the plan's limit
// and change allowance so the form can show what's allowed.
async function readKnownWebsites(db: Db, userId: ObjectId) {
  const [approved, allowance] = await Promise.all([
    getApprovedLinks(db, userId),
    getLinkAllowance(db, userId),
  ]);
  return { websites: approved.map((link) => link.url), linkAllowance: allowance };
}

const MAX_FULL_NAME_LENGTH = 100;
const MAX_TAG_LENGTH = 100;
const MAX_TAGS_PER_FIELD = 20;

// createIndex is idempotent but still costs a round trip — cache the
// promise so this only runs once per server process (same pattern as
// ensureCloakWatchIndexes/ensurePlanIndexes elsewhere in this codebase).
let indexesEnsuredPromise: Promise<void> | null = null;

function ensureIdentityProfileIndexes(db: Db) {
  if (!indexesEnsuredPromise) {
    indexesEnsuredPromise = db
      .collection(IDENTITY_PROFILES_COLLECTION)
      .createIndex({ userId: 1 }, { unique: true })
      .then(() => undefined)
      .catch((err) => {
        indexesEnsuredPromise = null;
        throw err;
      });
  }
  return indexesEnsuredPromise;
}

// Trims, drops empties, caps length per item and item count — applied to
// every tag-array field (usernames/aliases/websites/keywords) the same way.
function sanitizeTagArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, MAX_TAG_LENGTH);
    if (trimmed) cleaned.push(trimmed);
    if (cleaned.length >= MAX_TAGS_PER_FIELD) break;
  }
  return cleaned;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);
    const [profile, known] = await Promise.all([
      db.collection(IDENTITY_PROFILES_COLLECTION).findOne({ userId }),
      readKnownWebsites(db, userId),
    ]);

    return NextResponse.json({
      success: true,
      profile: profile ? { ...profile, websites: known.websites } : null,
      linkAllowance: known.linkAllowance,
    });
  } catch (error) {
    console.error("Error fetching identity profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const fullName = String(body?.fullName || "").trim().slice(0, MAX_FULL_NAME_LENGTH);

    const db = await getDb();
    await ensureIdentityProfileIndexes(db);

    const userId = new ObjectId(session.user.id);
    const now = new Date();

    // Known Websites first: if a link is invalid, over the limit or can't
    // be removed yet, nothing is saved.
    const linkChange = await setWatchedLinks(db, userId, sanitizeTagArray(body?.websites));
    if (!linkChange.ok) {
      return NextResponse.json({ error: linkChange.error }, { status: 400 });
    }
    const known = await readKnownWebsites(db, userId);

    const update: Omit<IdentityProfileDoc, "_id" | "createdAt"> = {
      userId,
      fullName,
      usernames: sanitizeTagArray(body?.usernames),
      aliases: sanitizeTagArray(body?.aliases),
      // Mirror of the watched links (fetchUrl holds the real list).
      websites: known.websites,
      keywords: sanitizeTagArray(body?.keywords),
      updatedAt: now,
    };

    await db.collection(IDENTITY_PROFILES_COLLECTION).updateOne(
      { userId },
      {
        $set: update,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    const saved = await db
      .collection<IdentityProfileDoc>(IDENTITY_PROFILES_COLLECTION)
      .findOne({ userId });

    // Tells the client to run link discovery (Scraping Links -> Confirm
    // Links). The fetch itself goes through POST /api/fetch-urls.
    const shouldFetchLinks = await shouldAutoFetchLinks(db, userId);

    // Newly typed-in links: scraped with the first scrape if it hasn't run
    // yet (Confirm Links starts it), otherwise straight away. With no fetch
    // coming (e.g. the plan's link limit is already full) the first scrape
    // starts now instead.
    let scrapeStarted = false;
    if (linkChange.added > 0 && (await getProfileCompleteness(db, userId)).complete) {
      const firstScrapeDone = await hasFirstScrapeRun(db, userId);
      if (firstScrapeDone || !shouldFetchLinks) {
        const scrape = await startPendingScrape(db, userId);
        // 409 = a scrape is already running; these links follow it.
        scrapeStarted = scrape.ok && scrape.started;
      }
    }

    return NextResponse.json({
      success: true,
      profile: saved,
      linkAllowance: known.linkAllowance,
      shouldFetchLinks,
      scrapeStarted,
    });
  } catch (error) {
    console.error("Error saving identity profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
