import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import {
  FETCH_URL_COLLECTION,
  getActiveLinkUrls,
  type FetchUrlDoc,
} from "@/lib/fetchLinks";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";

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
    const fetchUrlDoc = await db
      .collection<FetchUrlDoc>(FETCH_URL_COLLECTION)
      .findOne({ userId }, { sort: { updatedAt: -1 } });

    // Scan progress lives on the link-discovery job (GET /api/fetch-urls).
    return NextResponse.json({
      success: true,
      urls: getActiveLinkUrls(fetchUrlDoc),
      updatedAt: fetchUrlDoc?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Error fetching scan results:", error);
    return NextResponse.json(
      { error: "Failed to load scan results." },
      { status: 500 },
    );
  }
}
