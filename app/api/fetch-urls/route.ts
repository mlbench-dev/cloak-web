import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";

// The CV fetch-url service can be slow (same cold-start concern as the
// verification endpoint) — give it room instead of getting killed mid-flight.
export const maxDuration = 60;

// Mirrors firstLine() in the verification route.
function firstLine(value: string | undefined): string {
  return (value || "").split(/\r?\n/)[0].trim();
}

const FETCH_URL_API_BASE_URL =
  firstLine(process.env.FETCH_URL_API_URL) || "http://101.53.238.231:8080";
const FETCH_URL_API_ENDPOINT = `${FETCH_URL_API_BASE_URL}/api/v1/fetch-url/fetch`;

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

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const externalResponse = await fetch(FETCH_URL_API_ENDPOINT, {
      method: "POST",
      headers: getFetchUrlApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(requestBody),
    });

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
