import { ObjectId, type Db } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { AiConfidenceStatus, ReportDoc } from "@/models/User";
import { applyAiDetectionBadge } from "@/lib/notifications";
// Re-exported for existing importers (e.g. app/api/reports/route.ts) — the
// function itself now lives in lib/platform.ts, which has zero server-only
// dependencies, so client code can import it directly from there instead of
// from this file (which pulls in Mongo/Firebase Admin transitively).
export { detectPlatform } from "@/lib/platform";

const REPORT_AI_VERIFICATION_BASE_URL =
  process.env.VERIFICATION_API_URL?.trim() ||
  process.env.VERIFICATION_API_URL_URL?.trim() ||
  // process.env.SUBMIT_REPORT_AI_VERIFICATION?.trim() ||
  // process.env.SUBMIT_REPORT_AI_VERIFICATION_URL?.trim() ||
  "https://verification-739230282785.europe-west1.run.app";
const REPORT_AI_VERIFICATION_ENDPOINT = `${REPORT_AI_VERIFICATION_BASE_URL}/api/v1/social-media-verification/verify`;
const REPORT_AI_VERIFICATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes;

export const AI_CONFIDENCE_MAX_ATTEMPTS = 4;
export const AI_CONFIDENCE_RETRY_COOLDOWN_MS = 60 * 1000;

function readNumericConfidence(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeConfidence(value: number): number {
  const scaled = value > 0 && value < 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function normalizeSimilarity(value: unknown): number | null {
  const numeric = readNumericConfidence(value);
  return numeric === null ? null : normalizeConfidence(numeric);
}

function extractConfidence(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const results = Array.isArray(record.results) ? record.results : [];
  const nestedObjects = [record.data, record.result].filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );

  // `results` is a flat list — one entry per detected face across every
  // image, video frame, and (for reels/videos) the post's cover thumbnail
  // that the service checked. A single unrelated cover photo or a bad video
  // frame can sit right next to the entry that's the actual genuine match,
  // and *averaging* them together drags a real ~65% match down to ~35% —
  // effectively hiding the match. The highest `average_similarity` across
  // every result is the best evidence of a match, so that's what we report,
  // not the average of all of them.
  const resultSimilarities = results
    .map((result) => {
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return null;
      }
      const item = result as Record<string, unknown>;
      return normalizeSimilarity(
        item.average_similarity ?? item.averageSimilarity,
      );
    })
    .filter((value): value is number => value !== null);

  if (resultSimilarities.length > 0) {
    return Math.max(...resultSimilarities);
  }

  const directSimilarity = normalizeSimilarity(
    record.average_similarity ?? record.averageSimilarity,
  );
  if (directSimilarity !== null) return directSimilarity;

  const candidates: unknown[] = [
    record.aiConfidence,
    record.confidence,
    record.score,
    record.matchPercentage,
    record.match_percentage,
    record.confidencePercentage,
    record.percentage,
    record.verified === true ? 100 : null,
    record.verified === false ? 0 : null,
    record.match === true ? 100 : null,
    record.match === false ? 0 : null,
  ];

  for (const nested of nestedObjects) {
    candidates.push(
      nested.aiConfidence,
      nested.confidence,
      nested.score,
      nested.matchPercentage,
      nested.match_percentage,
      nested.confidencePercentage,
      nested.percentage,
      nested.verified === true ? 100 : null,
      nested.verified === false ? 0 : null,
      nested.match === true ? 100 : null,
      nested.match === false ? 0 : null,
    );
  }

  for (const candidate of candidates) {
    const numeric = readNumericConfidence(candidate);
    if (numeric !== null) return normalizeConfidence(numeric);
  }

  return null;
}

function summarizeVerificationResult(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const results = Array.isArray(record.results) ? record.results : [];
  const bestSimilarity = extractConfidence(payload);
  const facesMatched = readNumericConfidence(record.faces_matched);
  const imagesProcessed = readNumericConfidence(record.images_processed) ?? 0;
  const videosProcessed = readNumericConfidence(record.videos_processed) ?? 0;
  const totalProcessed = imagesProcessed + videosProcessed;

  if (typeof facesMatched === "number" && totalProcessed > 0) {
    const matchedText = `${Math.round(facesMatched)} face${
      Math.round(facesMatched) === 1 ? "" : "s"
    } matched`;
    const parts: string[] = [];
    if (imagesProcessed > 0)
      parts.push(`${imagesProcessed} image${imagesProcessed === 1 ? "" : "s"}`);
    if (videosProcessed > 0)
      parts.push(`${videosProcessed} video${videosProcessed === 1 ? "" : "s"}`);
    const processedText = `${parts.join(" and ")} processed`;
    if (bestSimilarity !== null) {
      return `${matchedText} out of ${processedText}, with a best match of ${bestSimilarity}%.`;
    }
    return `${matchedText} out of ${processedText}.`;
  }

  if (results.length > 0 && bestSimilarity !== null) {
    return `Verification completed with a best match of ${bestSimilarity}%.`;
  }

  return null;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const nestedObjects = [record.data, record.result].filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );

  const candidates: unknown[] = [
    record.message,
    record.detail,
    record.reason,
    record.error,
    record.note,
    record.description,
    record.aiConfidenceMessage,
    record.confidenceMessage,
    record.verificationMessage,
  ];

  for (const nested of nestedObjects) {
    candidates.push(
      nested.message,
      nested.detail,
      nested.reason,
      nested.error,
      nested.note,
      nested.description,
      nested.aiConfidenceMessage,
      nested.confidenceMessage,
      nested.verificationMessage,
    );
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

class AiConfidenceError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "AiConfidenceError";
    this.retryable = retryable;
  }
}

async function callAiVerificationService(input: {
  sourceLink: string;
  targetVerificationImages: string[];
}): Promise<{ confidence: number; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REPORT_AI_VERIFICATION_TIMEOUT_MS,
  );

  try {
    let response: Response;
    try {
      response = await fetch(REPORT_AI_VERIFICATION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          post_url: input.sourceLink,
          face1: input.targetVerificationImages[0],
          face2: input.targetVerificationImages[1],
          face3: input.targetVerificationImages[2],
        }),
        signal: controller.signal,
      });
    } catch (networkError) {
      const isAbort =
        networkError instanceof Error && networkError.name === "AbortError";
      throw new AiConfidenceError(
        isAbort
          ? "The verification service took too long to respond."
          : `Could not reach the verification service (${
              networkError instanceof Error
                ? networkError.message
                : "network error"
            }).`,
        true,
      );
    }

    const responseJson = await response.json().catch(() => null);

    if (!response.ok) {
      const apiMessage =
        extractMessage(responseJson) ||
        summarizeVerificationResult(responseJson) ||
        `Verification service responded with ${response.status}`;
      const retryable = response.status >= 500;
      throw new AiConfidenceError(apiMessage, retryable);
    }

    const confidence = extractConfidence(responseJson);
    if (confidence === null) {
      throw new AiConfidenceError(
        "Verification service response did not include a confidence score.",
        true,
      );
    }

    return {
      confidence,
      message:
        extractMessage(responseJson) ||
        summarizeVerificationResult(responseJson) ||
        "AI confidence calculated successfully.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mirrors the exact same "needs verification" logic used by
 * GET /api/reference-media (mode=profile) so the two stay consistent —
 * if that route's rule ever changes, update it here too.
 *
 * Returns the ordered, verified face image URLs (by `position`) to use
 * for face1/face2/face3, or an empty array if the target user hasn't
 * completed reference-media verification yet.
 */
async function getTargetFaceImages(
  db: Db,
  targetUserId: ObjectId,
): Promise<{ images: string[]; isVerified: boolean }> {
  const [user, media] = await Promise.all([
    db
      .collection("users")
      .findOne(
        { _id: targetUserId },
        { projection: { needsReferenceMediaVerification: 1 } },
      ),
    db
      .collection("referenceMedia")
      .find({ userId: targetUserId, status: "active" })
      .sort({ position: 1 })
      .toArray(),
  ]);

  const needsVerification =
    Boolean(user?.needsReferenceMediaVerification) ||
    media.some((item) => item.verificationStatus !== "verified");

  if (needsVerification) {
    return { images: [], isVerified: false };
  }

  const images = media
    .filter((item) => item.verificationStatus === "verified" && item.imageUrl)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((item) => item.imageUrl as string);

  return { images, isVerified: images.length > 0 };
}

type ReportWithId = ReportDoc & { _id: ObjectId };

export async function computeAndStoreAiConfidence(
  reportId: ObjectId,
): Promise<void> {
  const db = await getDb();
  const reportsCollection = db.collection<ReportDoc>("reports");

  const report = (await reportsCollection.findOne({
    _id: reportId,
  })) as ReportWithId | null;
  if (!report) return;

  const claim = await reportsCollection.updateOne(
    { _id: reportId, aiConfidenceStatus: { $ne: "processing" } },
    {
      $set: {
        aiConfidenceStatus: "processing",
        aiConfidenceLastAttemptAt: new Date(),
      },
      $inc: { aiConfidenceAttempts: 1 },
    },
  );
  if (claim.matchedCount === 0) return;

  const { images: targetVerificationImages, isVerified } =
    await getTargetFaceImages(db, report.targetUserId);

  if (!isVerified) {
    // Not a failure — just a gate that lifts once the target user
    // finishes reference-media verification. GET /api/reports/[id]
    // re-checks this cheaply on every view and flips it to "pending"
    // the moment it opens, without needing a full retry cycle.
    await reportsCollection.updateOne(
      { _id: reportId },
      {
        $set: {
          aiConfidence: 0,
          aiConfidenceSource: "fallback",
          aiConfidenceMessage:
            "The reported user hasn't completed identity verification yet, so we can't confirm whether they're the person in this post. We'll check again once they do.",
          aiConfidenceStatus: "awaiting_verification",
          updatedAt: new Date(),
        },
      },
    );
    return;
  }

  try {
    const result = await callAiVerificationService({
      sourceLink: report.sourceLink,
      targetVerificationImages,
    });

    await reportsCollection.updateOne(
      { _id: reportId },
      {
        $set: {
          aiConfidence: result.confidence,
          aiConfidenceSource: "api",
          aiConfidenceMessage: result.message,
          aiConfidenceStatus: "completed",
          updatedAt: new Date(),
        },
      },
    );

    await applyAiDetectionBadge(db, reportId, result.confidence);
  } catch (error) {
    console.error(
      `Error computing AI confidence for report ${reportId}:`,
      error,
    );

    const isRetryable =
      error instanceof AiConfidenceError ? error.retryable : true;
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Something went wrong while checking this report.";

    const attemptsSoFar = (report.aiConfidenceAttempts ?? 0) + 1;
    const exhausted = attemptsSoFar >= AI_CONFIDENCE_MAX_ATTEMPTS;
    const willRetry = isRetryable && !exhausted;

    await reportsCollection.updateOne(
      { _id: reportId },
      {
        $set: {
          aiConfidence: 0,
          aiConfidenceSource: "fallback",
          aiConfidenceMessage: willRetry
            ? "We couldn't calculate this yet — we'll automatically try again shortly."
            : message,
          aiConfidenceStatus: willRetry ? "pending" : "failed",
          updatedAt: new Date(),
        },
      },
    );
  }
}

export function getEffectiveAiConfidenceStatus(
  report: Pick<ReportDoc, "aiConfidenceStatus" | "aiConfidenceSource">,
): AiConfidenceStatus {
  if (report.aiConfidenceStatus) return report.aiConfidenceStatus;
  return report.aiConfidenceSource ? "completed" : "pending";
}

export function shouldAttemptAiConfidence(
  report: Pick<
    ReportDoc,
    | "aiConfidenceStatus"
    | "aiConfidenceSource"
    | "aiConfidenceAttempts"
    | "aiConfidenceLastAttemptAt"
  >,
  // Cloak Pro reporters get a shorter cooldown between retry
  // attempts (lib/config.ts PLAN_LIMITS.retryCooldownMs) — callers that
  // know the reporter's plan should pass it; defaults to the Freemium
  // cooldown when unknown.
  cooldownMs: number = AI_CONFIDENCE_RETRY_COOLDOWN_MS,
): boolean {
  const status = getEffectiveAiConfidenceStatus(report);
  if (
    status === "completed" ||
    status === "processing" ||
    status === "failed" ||
    status === "awaiting_verification" // handled separately, see refreshVerificationGate
  ) {
    return false;
  }

  const attempts = report.aiConfidenceAttempts ?? 0;
  if (attempts >= AI_CONFIDENCE_MAX_ATTEMPTS) return false;

  const lastAttempt = report.aiConfidenceLastAttemptAt;
  if (!lastAttempt) return true;
  return Date.now() - new Date(lastAttempt).getTime() >= cooldownMs;
}

export async function refreshVerificationGate(
  db: Db,
  reportId: ObjectId,
  report: Pick<
    ReportDoc,
    "targetUserId" | "aiConfidenceStatus" | "aiConfidenceSource"
  >,
): Promise<AiConfidenceStatus> {
  const currentStatus = getEffectiveAiConfidenceStatus(report);
  if (currentStatus !== "awaiting_verification") return currentStatus;

  const { isVerified } = await getTargetFaceImages(db, report.targetUserId);
  if (!isVerified) return currentStatus;

  await db
    .collection("reports")
    .updateOne(
      { _id: reportId },
      { $set: { aiConfidenceStatus: "pending", updatedAt: new Date() } },
    );
  report.aiConfidenceStatus = "pending";
  return "pending";
}
