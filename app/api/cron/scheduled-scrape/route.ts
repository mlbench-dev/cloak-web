import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { PLAN_LIMITS } from "@/lib/config";
import { findUsersDueForScheduledScrape, startScheduledScrape } from "@/lib/fetchLinks";
import type { PlanCode } from "@/models/Subscription";

// Each start is a quick call (the CV API answers "started" in about
// a second), but there can be many users per run.
export const maxDuration = 300;

// Users handled per run, and the time budget to stay inside maxDuration.
// Anyone not reached is still due, so the next run picks them up first
// (oldest last scrape first).
const BATCH_SIZE = 200;
const TIME_BUDGET_MS = 240_000;

// Re-scrapes watched links for plans with PLAN_LIMITS.autoScrapeEveryDays
// (Cloak Pro: every 2 days after the last scrape started). Triggered by
// Vercel Cron (see vercel.json) — which sends `Authorization: Bearer
// $CRON_SECRET` — or any scheduler that sends the same header.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Refuse outright when unset, so "Bearer undefined" can't get in.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const summary = { due: 0, started: 0, skipped: 0, failed: 0, outOfTime: false };

  try {
    const db = await getDb();

    for (const [plan, limits] of Object.entries(PLAN_LIMITS) as [
      PlanCode,
      (typeof PLAN_LIMITS)[PlanCode],
    ][]) {
      if (!limits.autoScrapeEveryDays) continue;

      const due = await findUsersDueForScheduledScrape(
        db,
        plan,
        limits.autoScrapeEveryDays,
        BATCH_SIZE,
      );
      summary.due += due.length;

      for (const userId of due) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          summary.outOfTime = true;
          break;
        }
        try {
          const result = await startScheduledScrape(db, userId);
          if (result.started) summary.started += 1;
          else summary.skipped += 1;
        } catch (error) {
          summary.failed += 1;
          console.error(`Scheduled scrape failed for ${userId.toString()}:`, error);
        }
      }
    }

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("Scheduled scrape run failed:", error);
    return NextResponse.json(
      { error: "Scheduled scrape failed", ...summary },
      { status: 500 },
    );
  }
}
