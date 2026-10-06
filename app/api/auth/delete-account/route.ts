import clientPromise from "@/lib/mongodb";
import {
  deleteFileFromFirebase,
  getStoragePathFromFirebaseUrl,
} from "@/lib/firebaseUtils";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

const addStoragePath = (paths: Set<string>, value?: string | null) => {
  if (!value) return;

  if (value.startsWith("uploads/") || value.startsWith("reference-media/")) {
    paths.add(value);
    return;
  }

  const parsedPath = getStoragePathFromFirebaseUrl(value);
  if (parsedPath) {
    paths.add(parsedPath);
  }
};

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = new ObjectId(session.user.id);
    const client = await clientPromise;
    const db = client.db();

    const user = await db.collection("users").findOne({ _id: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [referenceMedia, identityVerifications] = await Promise.all([
      db.collection("referenceMedia").find({ userId }).toArray(),
      db.collection("identityVerifications").find({ userId }).toArray(),
    ]);

    const storagePaths = new Set<string>();
    addStoragePath(storagePaths, user.image);
    addStoragePath(storagePaths, user.profileImage);

    referenceMedia.forEach((media) => {
      addStoragePath(storagePaths, media.storagePath);
      addStoragePath(storagePaths, media.imageUrl);
    });

    identityVerifications.forEach((verification) => {
      const imageUrls = [
        ...(Array.isArray(verification.verification_images) ? verification.verification_images : []),
        ...(Array.isArray(verification.documentUrls) ? verification.documentUrls : []),
      ];

      imageUrls.forEach((url) => addStoragePath(storagePaths, url));
    });

    const firebaseResults = await Promise.allSettled(
      Array.from(storagePaths).map((path) => deleteFileFromFirebase(path))
    );

    const failedStorageDeletes = firebaseResults.filter(
      (result) => result.status === "rejected"
    ).length;

    const deleteFilter = {
      $or: [{ userId }, { targetUserId: userId }],
    };

    const [
      usersResult,
      referenceMediaResult,
      identityVerificationResult,
      reportResult,
      recentSearchResult,
      otpResult,
    ] = await Promise.all([
      db.collection("users").deleteOne({ _id: userId }),
      db.collection("referenceMedia").deleteMany({ userId }),
      db.collection("identityVerifications").deleteMany({ userId }),
      db.collection("reports").deleteMany({
        $or: [{ reportedBy: userId }, { targetUserId: userId }],
      }),
      db.collection("recentSearches").deleteMany(deleteFilter),
      db.collection("otps").deleteMany({ email: user.email }),
    ]);

    return NextResponse.json({
      success: true,
      deleted: {
        users: usersResult.deletedCount,
        referenceMedia: referenceMediaResult.deletedCount,
        identityVerifications: identityVerificationResult.deletedCount,
        reports: reportResult.deletedCount,
        recentSearches: recentSearchResult.deletedCount,
        otps: otpResult.deletedCount,
        storageFiles: storagePaths.size - failedStorageDeletes,
      },
      failedStorageDeletes,
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account." },
      { status: 500 }
    );
  }
}
