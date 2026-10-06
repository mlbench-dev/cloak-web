import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";

// Mock fallback for accounts the CV/LLM discovery pipeline hasn't (yet, or
// ever) populated real results for — lets Cloak Watch be tested end to end
// without waiting on a real scan. Once the CV team's discovery API is
// reliably populating `fetchUrl` for every account, delete this block and
// the `.length > 0 ? real : MOCK_URLS` fallback below so this route just
// returns real data (or a real empty state) unconditionally.
//
// These are real, public profiles on purpose — the placeholder "johndoe"
// handles had no public picture (or didn't exist), so the link preview on
// the incident pages had nothing to show.
const MOCK_URLS = [
  "https://www.instagram.com/natgeo",
  "https://www.tiktok.com/@natgeo",
  "https://www.x.com/natgeo",
  "https://www.facebook.com/natgeo",
  "https://www.youtube.com/@natgeo",
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    // sort as a safety net in case this ever stops being a strict
    // one-doc-per-user upsert on the CV side
    const [fetchUrlDoc, userDoc] = await Promise.all([
      db.collection("fetchUrl").findOne({ userId }, { sort: { updatedAt: -1 } }),
      db
        .collection("users")
        .findOne({ _id: userId }, { projection: { lastScanTriggeredAt: 1 } }),
    ]);

    const realUrls: string[] = fetchUrlDoc?.urls ?? [];

    return NextResponse.json({
      success: true,
      urls: realUrls.length > 0 ? realUrls : MOCK_URLS,
      updatedAt: fetchUrlDoc?.updatedAt ?? null,
      // Lets the UI show a "scan in progress" state when a scan was
      // requested more recently than the last completed result set.
      lastScanTriggeredAt: userDoc?.lastScanTriggeredAt ?? null,
    });
  } catch (error) {
    console.error("Error fetching scan results:", error);
    return NextResponse.json(
      { error: "Failed to load scan results." },
      { status: 500 },
    );
  }
}
