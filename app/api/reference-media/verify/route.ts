import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { notifyVerificationResult } from "@/lib/notifications";

// Without this, the platform's default function timeout (on Vercel, as low
// as 10-15s depending on plan) can silently kill this request mid-flight —
// e.g. right after marking verificationInProgress: true but before the
// external call returns — leaving the user stuck on an infinite spinner.
// A Cloud Run cold start alone can eat 30-50s; give this room to actually
// finish. Lower this once the verification service is configured with
// min-instances > 0 to stay warm.
export const maxDuration = 60;

// Takes only the first line of an env var, then trims it — Secret Manager
// values pasted from a .env file sometimes carry an extra newline plus a
// trailing comment/line for a *different* variable (that's what actually
// happened to BEARER_TOKEN in production: the header value included a
// literal "\n# SUBMIT_REPORT_AI_VERIFICATION = ..." after the real token,
// which fetch's Headers.append rejects outright since header values can't
// contain a line break). A plain .trim() only strips the edges, so it
// can't clean up garbage stuck in the middle like that — this can.
function firstLine(value: string | undefined): string {
  return (value || "").split(/\r?\n/)[0].trim();
}

const VERIFICATION_API_BASE_URL =
  firstLine(process.env.VERIFICATION_API_URL) ||
  "https://verification-739230282785.europe-west1.run.app";
const VERIFICATION_API_ENDPOINT = `${VERIFICATION_API_BASE_URL}/api/v1/verification/verify`;
const VERIFICATION_API_UPDATE_ENDPOINT = `${VERIFICATION_API_BASE_URL}/api/v1/verification/update`;

// NOTE: this is a static token pasted into BEARER_TOKEN, not a token minted
// per-request from a service account. Google identity tokens (the kind
// `gcloud auth print-identity-token` prints) expire in ~1 hour — this value
// WILL go stale and start producing 401s in production until someone
// regenerates it and updates the env var (here and in Vercel) again. Fine
// as a stopgap; swap to google-auth-library + a service account (which
// mints and refreshes tokens automatically) before this is relied on
// unattended.
const VERIFICATION_API_BEARER_TOKEN = firstLine(process.env.BEARER_TOKEN);

function getVerificationApiHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  if (VERIFICATION_API_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${VERIFICATION_API_BEARER_TOKEN}`;
  }
  return headers;
}

type ApiDocumentType = "id_card" | "passport" | "driving_license";

// Stored documentType is the human-readable label shown in the identity
// verification form (see DOCUMENT_TYPES in IdentityVerificationStep.tsx),
// not the API's slug — translate between them.
function mapDocumentTypeToApiValue(
  documentType: unknown,
): ApiDocumentType | null {
  const normalized = String(documentType || "").toLowerCase();
  if (normalized.includes("passport")) return "passport";
  if (normalized.includes("driv")) return "driving_license";
  if (normalized.includes("national") || normalized.includes("id"))
    return "id_card";
  return null;
}

function toPercent(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return `${(value * 100).toFixed(2)}%`;
}

function getVerificationFailureReason(externalJson: any) {
  const detail = String(
    externalJson?.detail || externalJson?.message || "",
  ).trim();
  if (detail) {
    return detail;
  }

  const verifiedFlag = externalJson?.verified;
  const normalizedStatus = String(externalJson?.status || "").toUpperCase();
  const averageSimilarity = toPercent(externalJson?.average_similarity);
  const threshold = toPercent(externalJson?.threshold);

  if (verifiedFlag === false || normalizedStatus.includes("UNVERIFIED")) {
    if (averageSimilarity && threshold) {
      return `Face match similarity was ${averageSimilarity}, which is below the required ${threshold} threshold.`;
    }
    return "The submitted protected media did not match the identity document closely enough.";
  }

  return null;
}

function getVerificationHistoryEntry(
  status: "APPROVED" | "REJECTED",
  externalJson: any,
) {
  return {
    status,
    reason:
      status === "REJECTED" ? getVerificationFailureReason(externalJson) : null,
    createdAt: new Date(),
  };
}

export async function POST() {
  // Hoisted so the catch block can reset a stuck "verification in progress"
  // flag if something throws after we've already flipped it to true —
  // otherwise the user is left staring at an infinite "verifying" spinner
  // with no way to retry (see identityVerifications.verificationInProgress).
  let verificationDocId: ObjectId | null = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    let media = await db
      .collection("referenceMedia")
      .find({ userId, status: "active" })
      .sort({ uploadedAt: 1 })
      .toArray();

    // Backward compatibility: assign positions to images that don't have them
    const mediaWithoutPositions = media.filter(
      (m) => m.position === undefined || m.position === null,
    );
    if (mediaWithoutPositions.length > 0) {
      const existingPositions = media
        .map((m) => m.position)
        .filter((p) => p !== undefined && p !== null);
      let nextAvailablePosition = 1;

      for (const item of mediaWithoutPositions) {
        // Find next available position
        while (
          existingPositions.includes(nextAvailablePosition) ||
          media.some(
            (m) =>
              m._id.toString() !== item._id.toString() &&
              m.position === nextAvailablePosition,
          )
        ) {
          nextAvailablePosition++;
        }
        if (nextAvailablePosition <= 3) {
          await db
            .collection("referenceMedia")
            .updateOne(
              { _id: item._id },
              { $set: { position: nextAvailablePosition } },
            );
          item.position = nextAvailablePosition;
          nextAvailablePosition++;
        }
      }

      // Re-fetch media with updated positions
      media = await db
        .collection("referenceMedia")
        .find({ userId, status: "active" })
        .sort({ uploadedAt: 1 })
        .toArray();
    }

    const hasVerifiedReferenceMedia = media.some(
      (item) => item.verificationStatus === "verified",
    );
    const requiresThreeImages = !hasVerifiedReferenceMedia;
    const pendingMedia = media.filter(
      (item) => item.verificationStatus !== "verified",
    );
    const mediaForVerification = requiresThreeImages
      ? media.slice(0, 3)
      : pendingMedia.slice(-1);

    if (!requiresThreeImages && media.length === 0) {
      return NextResponse.json(
        {
          error: "At least 1 reference image is required for re-verification.",
        },
        { status: 400 },
      );
    }

    if (!requiresThreeImages && mediaForVerification.length === 0) {
      return NextResponse.json(
        { error: "Please upload new protected media before re-verifying." },
        { status: 400 },
      );
    }

    if (requiresThreeImages && media.length < 3) {
      return NextResponse.json(
        {
          error:
            "At least 3 reference images are required for your first verification.",
        },
        { status: 400 },
      );
    }

    const verificationDoc = await db
      .collection("identityVerifications")
      .findOne({ userId }, { sort: { updatedAt: -1 } });
    verificationDocId = verificationDoc?._id ?? null;

    if (
      !verificationDoc?.verification_images ||
      verificationDoc.verification_images.length === 0
    ) {
      return NextResponse.json(
        { error: "No identity verification documents found for this user." },
        { status: 400 },
      );
    }

    const faceUrls = mediaForVerification
      .map((item) => item.imageUrl)
      .filter(Boolean);
    if (requiresThreeImages && faceUrls.length !== 3) {
      return NextResponse.json(
        {
          error:
            "Failed to load all 3 protected media images for the first verification.",
        },
        { status: 400 },
      );
    }

    if (!requiresThreeImages && faceUrls.length === 0) {
      return NextResponse.json(
        { error: "No protected media images were found for verification." },
        { status: 400 },
      );
    }

    const documentTypeForApi = mapDocumentTypeToApiValue(
      verificationDoc.documentType,
    );
    if (!documentTypeForApi) {
      return NextResponse.json(
        {
          error:
            "Your identity document type could not be determined. Please re-submit your document.",
        },
        { status: 400 },
      );
    }

    if (!VERIFICATION_API_BEARER_TOKEN) {
      console.error(
        "BEARER_TOKEN is not configured — cannot call the verification service.",
      );
      return NextResponse.json(
        {
          error:
            "Server not available, try again later from the Protected Media menu.",
        },
        { status: 502 },
      );
    }

    const idCardUrl = verificationDoc.verification_images[0];
    const requestBody: Record<string, string> = {
      id_card: idCardUrl,
      document_type: documentTypeForApi,
    };

    // Map images to their stored positions
    mediaForVerification.forEach((item) => {
      const pos = item.position || 1;
      requestBody[`face${pos}`] = item.imageUrl;
    });

    await db.collection("users").updateOne(
      { _id: userId },
      {
        $set: {
          identityVerificationStatus: "PENDING",
          needsReferenceMediaVerification: true,
          updatedAt: new Date(),
        },
      },
    );

    if (verificationDoc._id) {
      await db.collection("identityVerifications").updateOne(
        { _id: verificationDoc._id },
        {
          $set: {
            status: "PENDING",
            verificationInProgress: true,
            verificationResult: null,
            verificationFailureReason: null,
            updatedAt: new Date(),
          },
        },
      );
    }

    // A failure here is an infrastructure/auth problem, not evidence the
    // user's identity didn't match — never let this path fall through to
    // marking identityVerificationStatus as REJECTED. It resets
    // verificationInProgress (so the "Upload Media" retry screen shows up
    // instead of an infinite spinner) and leaves status as-is for a retry.
    const respondServiceUnavailable = async () => {
      if (verificationDoc._id) {
        await db.collection("identityVerifications").updateOne(
          { _id: verificationDoc._id },
          {
            $set: {
              verificationInProgress: false,
              updatedAt: new Date(),
            },
          },
        );
      }
      return NextResponse.json(
        {
          error:
            "Server not available, try again later from the Protected Media menu.",
        },
        { status: 502 },
      );
    };

    const verificationEndpoint = requiresThreeImages
      ? VERIFICATION_API_ENDPOINT
      : VERIFICATION_API_UPDATE_ENDPOINT;
    const verificationMethod = requiresThreeImages ? "POST" : "PATCH";

    // TEMP debug logging while chasing the passport/driving_license
    // mismatch — remove once resolved.
    console.log("[verify] calling verification service", {
      endpoint: verificationEndpoint,
      method: verificationMethod,
      requiresThreeImages,
      requestBody,
    });

    const externalResponse = await fetch(verificationEndpoint, {
      method: verificationMethod,
      headers: getVerificationApiHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(requestBody),
    });

    const externalJson = await externalResponse.json().catch(() => null);

    console.log("[verify] verification service responded", {
      status: externalResponse.status,
      body: externalJson,
    });

    // Auth failures and server errors mean the check never actually ran —
    // only a genuine content-based rejection (422, or the parsed signals
    // below on a 2xx) should ever write REJECTED to the user's record.
    if (
      externalResponse.status === 401 ||
      externalResponse.status === 403 ||
      externalResponse.status >= 500
    ) {
      console.error(
        "Verification service call failed:",
        externalResponse.status,
        externalJson,
      );
      return respondServiceUnavailable();
    }

    let identityVerificationStatus: "APPROVED" | "REJECTED" = "REJECTED";

    if (!externalResponse.ok) {
      // Everything reaching here (401/403/5xx already handled above) is a
      // genuine content-based rejection from the service, e.g. 422.
      identityVerificationStatus = "REJECTED";
    } else {
      const normalizedStatus = String(externalJson?.status || "").toUpperCase();
      const verifiedFlag = externalJson?.verified;

      if (verifiedFlag === true) {
        identityVerificationStatus = "APPROVED";
      } else if (
        normalizedStatus.includes("APPROV") ||
        normalizedStatus.includes("SUCCESS")
      ) {
        identityVerificationStatus = "APPROVED";
      }

      if (verifiedFlag === false) {
        identityVerificationStatus = "REJECTED";
      }

      if (
        normalizedStatus.includes("REJECT") ||
        normalizedStatus.includes("FAIL")
      ) {
        identityVerificationStatus = "REJECTED";
      }

      if (
        externalJson?.result === "no_match" ||
        externalJson?.match === false
      ) {
        identityVerificationStatus = "REJECTED";
      }
    }

    await db.collection("users").updateOne(
      { _id: userId },
      {
        $set: {
          identityVerificationStatus,
          needsReferenceMediaVerification:
            identityVerificationStatus !== "APPROVED",
          updatedAt: new Date(),
        },
      },
    );

    if (identityVerificationStatus === "APPROVED") {
      await db.collection("referenceMedia").updateMany(
        {
          _id: { $in: mediaForVerification.map((item) => item._id) },
          userId,
        },
        {
          $set: {
            verificationStatus: "verified",
            verifiedAt: new Date(),
          },
        },
      );
    }

    if (verificationDoc._id) {
      const verificationFailureReason =
        identityVerificationStatus === "REJECTED"
          ? getVerificationFailureReason(externalJson)
          : null;
      const historyEntry = getVerificationHistoryEntry(
        identityVerificationStatus,
        externalJson,
      );
      await db
        .collection("identityVerifications")
        .updateOne({ _id: verificationDoc._id }, {
          $set: {
            status: identityVerificationStatus,
            verificationInProgress: false,
            verificationResult: externalJson,
            verificationFailureReason,
            updatedAt: new Date(),
          },
          $push: {
            verificationHistory: {
              $each: [historyEntry],
              $slice: -5,
            },
          },
        } as any);

      await notifyVerificationResult(db, {
        userId,
        status: identityVerificationStatus,
        failureReason: verificationFailureReason,
      });
    }

    return NextResponse.json({
      success: true,
      identityVerificationStatus,
      externalResponse: externalJson,
    });
  } catch (error) {
    console.error("Error verifying protected media:", error);

    // We may have already marked verification as "in progress" before this
    // blew up (e.g. the verification service was unreachable). Clear that
    // flag so the user isn't stuck on an infinite "verifying" spinner with
    // no way to retry — they'll land back on the "Verification is Pending"
    // screen, which offers an "Upload Media" retry action.
    if (verificationDocId) {
      try {
        const client = await clientPromise;
        const db = client.db();
        await db.collection("identityVerifications").updateOne(
          { _id: verificationDocId },
          {
            $set: {
              verificationInProgress: false,
              verificationFailureReason:
                "Verification could not be completed. Please try again.",
              updatedAt: new Date(),
            },
          },
        );
      } catch (resetError) {
        console.error(
          "Failed to reset verificationInProgress after error:",
          resetError,
        );
      }
    }

    return NextResponse.json(
      { error: "Verification request failed. Please try again." },
      { status: 500 },
    );
  }
}
