import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";

// The CV fetch-url service can be slow (same cold-start concern as the
// verification endpoint, compounded by fetching NUMBER_OF_REQUESTS URLs
// per call) — 60s wasn't enough in practice (Vercel killed the function
// outright at the platform level, which skips our own try/catch entirely
// and returns a bare timeout instead of a clean error). Matches the
// precedent already set in app/api/reports/route.ts for slow external
// calls.
export const maxDuration = 600;

// Aborts the external call a bit before maxDuration so our own catch block
// gets a chance to respond with a clean JSON error — otherwise Vercel's
// platform-level kill at maxDuration skips application code entirely and
// the client just sees a bare timeout.
const FETCH_URL_API_TIMEOUT_MS = 570_000;

// Mirrors firstLine() in the verification route.
function firstLine(value: string | undefined): string {
  return (value || "").split(/\r?\n/)[0].trim();
}

// No hardcoded fallback here on purpose — a stale/unreachable default
// silently sends every request to a dead address and shows up in prod logs
// as an opaque ECONNREFUSED instead of a clear "not configured" error.
// Missing config should fail loudly (see the check in POST below), not
// fall back to guessing an endpoint.
const FETCH_URL_API_BASE_URL = firstLine(process.env.FETCH_URL_API_URL);
const FETCH_URL_API_ENDPOINT = FETCH_URL_API_BASE_URL
  ? `${FETCH_URL_API_BASE_URL}/api/v1/fetch-url/fetch`
  : "";

// Only kicks in if the CV service ends up requiring auth — harmless no-op
// otherwise, same as VERIFICATION_API_BEARER_TOKEN.
const FETCH_URL_API_BEARER_TOKEN = firstLine(
  process.env.FETCH_URL_BEARER_TOKEN,
);

function getFetchUrlApiHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  if (FETCH_URL_API_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${FETCH_URL_API_BEARER_TOKEN}`;
  }
  return headers;
}

const NUMBER_OF_REQUESTS = 15;

// The CV team's discovery API isn't ready yet, so "Scan Now" runs as a mock
// for now: no external call, just a short wait so the Scraping Posts screen
// has something to show, after which the dashboard reloads
// /api/scan-results (which serves the mock/test links). Once the real API
// is ready, set FETCH_URL_USE_REAL_API=true in the environment — the real
// implementation below is untouched.
const USE_MOCK_SCAN = process.env.FETCH_URL_USE_REAL_API !== "true";
const MOCK_SCAN_DURATION_MS = 4000;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (USE_MOCK_SCAN) {
      await new Promise((resolve) => setTimeout(resolve, MOCK_SCAN_DURATION_MS));
      // Deliberately doesn't stamp lastScanTriggeredAt — nothing ever
      // completes a mock scan on the CV side, so Cloak Watch would show
      // "Scraping is in Progress" forever.
      return NextResponse.json({ success: true, mock: true, result: null });
    }

    if (!FETCH_URL_API_BASE_URL) {
      console.error(
        "FETCH_URL_API_URL is not configured — cannot call the fetch-url service.",
      );
      return NextResponse.json(
        { error: "Scan service is not configured. Please try again later." },
        { status: 502 },
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    // IMPORTANT: mirror whatever /api/identity-profile actually queries here,
    // so a direct POST to this route can't bypass the same "profile must be
    // complete" rule the dashboard enforces client-side (hasRequiredIdentityDetails).
    // Left as a TODO since I haven't seen that route's collection/field names —
    // send it over and I'll wire the real check in.
    //
    // const identityProfile = await db.collection("???").findOne({ userId });
    // if (!isIdentityProfileComplete(identityProfile)) {
    //   return NextResponse.json(
    //     { error: "Complete your identity profile before scanning." },
    //     { status: 400 },
    //   );
    // }

    const requestBody = {
      userId: session.user.id,
      numberOfRequests: NUMBER_OF_REQUESTS,
    };

    let externalResponse: Response;
    try {
      const timeoutSignal = AbortSignal.timeout(FETCH_URL_API_TIMEOUT_MS);
      externalResponse = await fetch(FETCH_URL_API_ENDPOINT, {
        method: "POST",
        headers: getFetchUrlApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(requestBody),
        signal: timeoutSignal,
      });
    } catch (networkError) {
      // Separated from the generic catch below so "the CV service is
      // unreachable or too slow" (wrong URL, service down, DNS/connection
      // refused, or it just didn't respond within our own timeout) logs
      // with the endpoint it tried instead of getting lumped in with an
      // unrelated bug elsewhere in this route.
      console.error(
        "fetch-url scan: could not reach the service in time:",
        FETCH_URL_API_ENDPOINT,
        networkError,
      );
      return NextResponse.json(
        { error: "Scan could not be started. Please try again." },
        { status: 502 },
      );
    }

    const externalJson = await externalResponse.json().catch(() => null);

    if (!externalResponse.ok) {
      console.error(
        "fetch-url scan failed:",
        externalResponse.status,
        externalJson,
      );
      return NextResponse.json(
        { error: "Scan could not be started. Please try again." },
        { status: 502 },
      );
    }

    // Stamps when the scan fired so the dashboard's "Last scan"/"Next scan"
    // card can eventually show something real instead of MOCK_STATS.
    await db
      .collection("users")
      .updateOne(
        { _id: userId },
        { $set: { lastScanTriggeredAt: new Date() } },
      );

    return NextResponse.json({ success: true, result: externalJson });
  } catch (error) {
    console.error("Error triggering scan:", error);
    return NextResponse.json(
      { error: "Scan request failed. Please try again." },
      { status: 500 },
    );
  }
}

// Removes one or more links from the user's watch list (Cloak Watch's
// select-and-delete mode). Pulling from the array in place rather than
// re-running the CV scan — the CV service only knows how to (re)discover
// links, not forget ones a user has dismissed.
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const urls = Array.isArray(body?.urls)
      ? body.urls.filter((url: unknown): url is string => typeof url === "string")
      : [];

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "No links provided to delete." },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    const result = await db
      .collection<{ userId: ObjectId; urls: string[] }>("fetchUrl")
      .updateOne({ userId }, { $pull: { urls: { $in: urls } } });

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
