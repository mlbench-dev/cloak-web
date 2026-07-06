import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

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
    
    const candidates = [
      `${baseCleaned}${Math.floor(Math.random() * 1000)}`,
      `${baseCleaned}_${Math.floor(Math.random() * 100)}`,
      `${baseCleaned}${Math.floor(Math.random() * 100)}`,
      `the${baseCleaned}`,
      `${baseCleaned}official`,
    ];

    for (const candidate of candidates) {
      if (suggestions.length >= 3) break;
      
      const exists = await db.collection("users").findOne({ username: candidate });
      if (!exists && !suggestions.includes(candidate)) {
        suggestions.push(candidate);
      }
    }

    // Fill up to 3 suggestions if needed
    while (suggestions.length < 3) {
        const fallback = `${baseCleaned}${Math.floor(Math.random() * 10000)}`;
        const exists = await db.collection("users").findOne({ username: fallback });
        if (!exists && !suggestions.includes(fallback)) {
            suggestions.push(fallback);
        }
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error generating username suggestions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
