import clientPromise from "@/lib/mongodb";
import { deleteFileFromFirebase } from "@/lib/firebaseUtils";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);
    
    console.log("Deleting media with id:", params.id, "for user:", userId);
    
    // Check if the id is a valid ObjectId
    let mediaId;
    try {
      mediaId = new ObjectId(params.id);
    } catch (err) {
      return NextResponse.json({ error: "Invalid media ID" }, { status: 400 });
    }

    // Find the media item and verify ownership
    const media = await db.collection("referenceMedia").findOne({
      _id: mediaId,
      userId
    });
    console.log("Found media:", media);

    if (!media) {
      return NextResponse.json(
        { error: "Media not found" },
        { status: 404 }
      );
    }

    // Delete from Firebase Storage first
    if (media.storagePath) {
      try {
        await deleteFileFromFirebase(media.storagePath);
      } catch (firebaseErr) {
        console.error("Failed to delete from Firebase, but will still delete from DB:", firebaseErr);
      }
    }

    // Hard delete from MongoDB
    await db.collection("referenceMedia").deleteOne({
      _id: mediaId,
      userId
    });

    const user = await db.collection("users").findOne(
      { _id: userId },
      { projection: { identityVerificationStatus: 1 } }
    );

    if (user?.identityVerificationStatus === "APPROVED") {
      await db.collection("users").updateOne(
        { _id: userId },
        {
          $set: {
            needsReferenceMediaVerification: true,
            updatedAt: new Date(),
          },
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting protected media:", error);
    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 }
    );
  }
}
