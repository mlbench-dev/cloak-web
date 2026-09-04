import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId, type Db } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { IdentityProfileDoc } from "@/models/IdentityProfile";

const IDENTITY_PROFILES_COLLECTION = "identityProfiles";

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
    const profile = await db
      .collection(IDENTITY_PROFILES_COLLECTION)
      .findOne({ userId: new ObjectId(session.user.id) });

    return NextResponse.json({ success: true, profile: profile || null });
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

    const update: Omit<IdentityProfileDoc, "_id" | "createdAt"> = {
      userId,
      fullName,
      usernames: sanitizeTagArray(body?.usernames),
      aliases: sanitizeTagArray(body?.aliases),
      websites: sanitizeTagArray(body?.websites),
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
      .collection(IDENTITY_PROFILES_COLLECTION)
      .findOne({ userId });

    return NextResponse.json({ success: true, profile: saved });
  } catch (error) {
    console.error("Error saving identity profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
