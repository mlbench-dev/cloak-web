import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";

const VERIFICATION_API_BASE_URL =
  process.env.VERIFICATION_API_URL || "http://192.168.0.171:8000";
const VERIFICATION_API_ENDPOINT = `${VERIFICATION_API_BASE_URL}/api/v1/verification/verify`;
const VERIFICATION_API_UPDATE_ENDPOINT = `${VERIFICATION_API_BASE_URL}/api/v1/verification/update`;
const VERIFICATION_API_HEALTH_ENDPOINT = `${VERIFICATION_API_BASE_URL}/health`;

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

    const idCardUrl = verificationDoc.verification_images[0];
    const requestBody: Record<string, string> = {
      id_card: idCardUrl,
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

    const healthResponse = await fetch(VERIFICATION_API_HEALTH_ENDPOINT, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!healthResponse.ok) {
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
      console.error(
        "Verification service health check failed:",
        healthResponse.status,
      );
      return NextResponse.json(
        {
          error:
            "Server not available, try again later from the Protected Media menu.",
        },
        { status: 502 },
      );
    }

    const healthJson = await healthResponse.json().catch(() => null);
    if (healthJson && String(healthJson.status).toLowerCase() !== "ok") {
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
      console.error("Verification service unhealthy:", healthJson);
      return NextResponse.json(
        {
          error:
            "Server not available, try again later from the Protected Media menu.",
        },
        { status: 502 },
      );
    }

    const externalResponse = await fetch(
      requiresThreeImages
        ? VERIFICATION_API_ENDPOINT
        : VERIFICATION_API_UPDATE_ENDPOINT,
      {
        method: requiresThreeImages ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    const externalJson = await externalResponse.json().catch(() => null);

    let identityVerificationStatus: "APPROVED" | "REJECTED" = "REJECTED";

    if (!externalResponse.ok) {
      if (externalResponse.status === 422) {
        identityVerificationStatus = "REJECTED";
      } else {
        identityVerificationStatus = "REJECTED";
        // return NextResponse.json(
        //   {
        //     error:
        //       externalJson?.detail ||
        //       externalJson?.message ||
        //       "Human verification service unavailable.",
        //   },
        //   { status: 502 }
        // );
      }
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
    }

    return NextResponse.json({
      success: true,
      identityVerificationStatus,
      externalResponse: externalJson,
    });
  } catch (error) {
    console.error("Error verifying protected media:", error);
    return NextResponse.json(
      { error: "Verification request failed." },
      { status: 500 },
    );
  }
}
