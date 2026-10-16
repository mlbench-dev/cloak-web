import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { finalizeScrapeIfDone, isLinkInCurrentScrape } from "@/lib/fetchLinks";
import { pingLiveNotification } from "@/lib/notifications";

// Called by the CV API once per finished link (complete or failed) of a
// scrape started from Confirm Links. Not a user request — there's no
// session; it's trusted only through the HMAC signature below.
//
// The CV API has already written the link's scrapeStatus to fetchUrl when
// this arrives, so "is the whole run done?" is decided from fetchUrl, and
// duplicate or out-of-order callbacks are harmless.

const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

type SignatureCheck = { ok: true } | { ok: false; reason: string };

// Short, non-reversible fingerprint of the secret, so both teams can check
// they hold the same value without sharing it: sha256(secret), first 8 hex.
function secretFingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 8);
}

function verifySignature(rawBody: string, timestamp: string, signature: string): SignatureCheck {
  const secret = (process.env.SCRAPE_CALLBACK_SECRET || "").trim();
  if (!secret) return { ok: false, reason: "SCRAPE_CALLBACK_SECRET is not set" };
  if (!timestamp) return { ok: false, reason: "missing X-Signature-Timestamp header" };
  if (!signature) return { ok: false, reason: "missing X-Signature header" };

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, reason: `X-Signature-Timestamp isn't a number: ${timestamp}` };
  }
  const skew = Math.round(Date.now() / 1000 - sentAt);
  if (Math.abs(skew) > SIGNATURE_MAX_AGE_SECONDS) {
    return {
      ok: false,
      reason: `timestamp is ${skew}s off our clock (limit ${SIGNATURE_MAX_AGE_SECONDS}s)${
        sentAt > 1e12 ? " — looks like milliseconds, expected seconds" : ""
      }`,
    };
  }

  // HMAC-SHA256 over "<timestamp>.<raw body>", hex — the CV API's scheme.
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const received = signature.replace(/^sha256=/, "");
  const matches =
    received.length === expected.length &&
    timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!matches) {
    return {
      ok: false,
      reason: `signature mismatch — most likely a different secret (ours has fingerprint ${secretFingerprint(
        secret,
      )}; compare with sha256(secret)[:8] on the CV side)${
        signature.startsWith("sha256=") ? "" : "; header is also missing the sha256= prefix"
      }`,
    };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  // Exact bytes as sent — the signature covers the raw body, so this must
  // be read before (and instead of) request.json().
  const rawBody = await request.text();

  if (!process.env.SCRAPE_CALLBACK_SECRET) {
    console.error("SCRAPE_CALLBACK_SECRET is not configured — rejecting scrape callback.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const check = verifySignature(
    rawBody,
    request.headers.get("x-signature-timestamp") || "",
    request.headers.get("x-signature") || "",
  );
  if (!check.ok) {
    // Logged, not returned — the caller only learns it was rejected.
    console.warn(`Scrape callback rejected: ${check.reason}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    userId?: unknown;
    linkUuid?: unknown;
    scrapeStatus?: unknown;
    link?: { url?: unknown; error?: unknown; postsFound?: unknown; newResults?: unknown };
  } | null = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }

  const userIdRaw = typeof payload?.userId === "string" ? payload.userId : "";
  const linkUuid = typeof payload?.linkUuid === "string" ? payload.linkUuid : "";
  // A malformed but correctly signed callback won't get better on retry —
  // answer 200 so the CV API doesn't keep resending it.
  if (!ObjectId.isValid(userIdRaw) || !linkUuid) {
    console.error("Scrape callback with missing userId/linkUuid:", payload);
    return NextResponse.json({ ok: true, ignored: true });
  }

  // The CV API only explains a failure in the callback — log it so it can
  // be traced (fetchUrl just says "failed").
  if (payload?.scrapeStatus === "failed") {
    console.warn(
      `Scrape failed for ${String(payload.link?.url ?? linkUuid)} (user ${userIdRaw}):`,
      payload.link?.error ?? "no reason given",
    );
  }

  const userId = new ObjectId(userIdRaw);
  const db = await getDb();

  // Only links from the user's current run move it forward; anything else
  // (an older run, an unknown link) is acknowledged and dropped.
  if (!(await isLinkInCurrentScrape(db, userId, linkUuid))) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Answer fast (the CV API wants a 2xx within 20s); the rest runs after.
  after(async () => {
    try {
      await finalizeScrapeIfDone(db, userId);
      // Always ping, so open screens pick up this link's progress — and the
      // run finishing. (Closing a run only sends an alert, which pings too,
      // when new posts were found, so that can't be relied on.)
      await pingLiveNotification(userId);
    } catch (error) {
      console.error("Scrape callback follow-up failed:", error);
    }
  });

  return NextResponse.json({ ok: true });
}
