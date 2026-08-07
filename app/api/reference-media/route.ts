import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function GET() {
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
        .sort({ position: 1 })
        .toArray();
    } else {
      // Sort by position for consistent ordering
      media.sort((a, b) => (a.position || 0) - (b.position || 0));
    }

    const user = await db
      .collection("users")
      .findOne(
        { _id: userId },
        { projection: { needsReferenceMediaVerification: 1 } },
      );

    return NextResponse.json({
      success: true,
      needsReferenceMediaVerification:
        Boolean(user?.needsReferenceMediaVerification) ||
        media.some((item) => item.verificationStatus !== "verified"),
      data: media.map((item) => ({
        id: item._id.toString(),
        imageUrl: item.imageUrl,
        verificationStatus: item.verificationStatus || "pending",
        uploadedAt: item.uploadedAt,
        ...item,
      })),
    });
  } catch (error) {
    console.error("Error fetching protected media:", error);
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 },
    );
  }
}
