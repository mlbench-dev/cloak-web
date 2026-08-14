import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { NOTIFICATIONS_COLLECTION, toAlertApiItem } from "@/lib/notifications";

// A streaming response — never statically optimize/cache this route.
export const dynamic = "force-dynamic";
// NOTE: same caveat as app/api/reports/route.ts — Vercel Hobby hard-caps
// function duration at 10s regardless of this value, Pro tops out at 300s
// (800s with Fluid Compute). When the connection is cut, the browser's
// native EventSource reconnects automatically and a fresh change stream
// picks up from there — no data is lost, since the client always does a
// REST fetch (GET /api/alerts) for history on load/mark-viewed and only
// relies on this stream for *live* deltas while connected.
export const maxDuration = 300;

const HEARTBEAT_INTERVAL_MS = 20000;

function safeObjectId(value: string) {
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

// Pushes a notification to the client the instant it's inserted, via a
// MongoDB change stream (available because the app runs on Atlas, whose
// clusters are always replica sets) — no polling, on either end.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = safeObjectId(session.user.id);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = await getDb();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const changeStream = db.collection(NOTIFICATIONS_COLLECTION).watch([
        {
          $match: {
            operationType: "insert",
            "fullDocument.userId": userId,
          },
        },
      ]);

      let closed = false;

      const cleanup = async () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeatId);
        try {
          await changeStream.close();
        } catch {
          // already closed
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const heartbeatId = setInterval(() => {
        // Keeps intermediary proxies/load balancers from timing out an
        // idle connection — a comment line, ignored by EventSource parsing.
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          void cleanup();
        }
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        void cleanup();
      });

      try {
        for await (const change of changeStream) {
          if (closed) break;
          const doc = (change as { fullDocument?: unknown }).fullDocument;
          if (!doc) continue;

          const alert = toAlertApiItem(doc);
          controller.enqueue(
            encoder.encode(`event: alert\ndata: ${JSON.stringify(alert)}\n\n`),
          );
        }
      } catch (error) {
        if (!closed) {
          console.error("Alerts change stream error:", error);
        }
      } finally {
        await cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
