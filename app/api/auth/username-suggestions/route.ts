import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

const MAX_USERNAME_LENGTH = 20;

// Trims `base` so that prefix + base + suffix never exceeds MAX_USERNAME_LENGTH
function buildCandidate(prefix: string, base: string, suffix: string): string {
  const maxBaseLen = Math.max(
    0,
    MAX_USERNAME_LENGTH - prefix.length - suffix.length,
  );
  const trimmedBase = base.slice(0, maxBaseLen);
  return `${prefix}${trimmedBase}${suffix}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") || "";

  if (!base) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    const suggestions: string[] = [];
    const baseCleaned = base.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();

    // Strategy 1: base + random numbers
    // Strategy 2: base + underscores
    // Strategy 3: variants of base
    // Each candidate is built with buildCandidate so the total length
    // (prefix + base + suffix) never exceeds MAX_USERNAME_LENGTH, even
    // when baseCleaned is already close to the 20-char limit.

    const candidates = [
      buildCandidate(
        "",
        baseCleaned,
        Math.floor(Math.random() * 1000).toString(),
      ),
      buildCandidate("", baseCleaned, `_${Math.floor(Math.random() * 100)}`),
      buildCandidate(
        "",
        baseCleaned,
        Math.floor(Math.random() * 100).toString(),
      ),
      buildCandidate("the", baseCleaned, ""),
      buildCandidate("", baseCleaned, "official"),
    ];

    for (const candidate of candidates) {
      if (suggestions.length >= 3) break;
      if (!candidate) continue; // skip empty/degenerate candidates

      const exists = await db
        .collection("users")
        .findOne({ username: candidate });
      if (!exists && !suggestions.includes(candidate)) {
        suggestions.push(candidate);
      }
    }

    // Fill up to 3 suggestions if needed
    let fallbackAttempts = 0;
    const MAX_FALLBACK_ATTEMPTS = 25; // safety valve against an unlucky infinite loop

    while (suggestions.length < 3 && fallbackAttempts < MAX_FALLBACK_ATTEMPTS) {
      fallbackAttempts++;
      const fallback = buildCandidate(
        "",
        baseCleaned,
        Math.floor(Math.random() * 10000).toString(),
      );
      if (!fallback) continue;

      const exists = await db
        .collection("users")
        .findOne({ username: fallback });
      if (!exists && !suggestions.includes(fallback)) {
        suggestions.push(fallback);
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error generating username suggestions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
