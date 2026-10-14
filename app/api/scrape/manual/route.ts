import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getLinkFetchStatus, startManualScan } from "@/lib/fetchLinks";

// The dashboard's Scan button: a one-off re-scrape of all watched links for
// plans that include it (see getManualScanState in lib/fetchLinks.ts for
// when it's allowed). Progress is read from GET /api/fetch-urls.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    const result = await startManualScan(db, userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const status = await getLinkFetchStatus(db, userId);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error("Error starting manual scan:", error);
    return NextResponse.json(
      { error: "Couldn't start the scan. Please try again." },
      { status: 500 },
    );
  }
}
