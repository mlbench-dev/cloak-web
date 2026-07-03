import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { userId, documentType, documentUrls } = await request.json();

    if (!userId || !documentType || !documentUrls || !Array.isArray(documentUrls)) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Check if there's an existing verification for this user
    const existingVerification = await db.collection("identityVerifications").findOne({
      userId: new ObjectId(userId)
    });

    if (existingVerification) {
      // Update existing verification
      await db.collection("identityVerifications").updateOne(
        { _id: existingVerification._id },
        {
          $set: {
            documentType,
            verification_images: documentUrls,
            status: "PENDING",
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Create new verification
      await db.collection("identityVerifications").insertOne({
        userId: new ObjectId(userId),
        documentType,
        verification_images: documentUrls,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Update only the status in user collection (not the full data)
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          identityVerificationStatus: "PENDING",
          updatedAt: new Date()
        },
        // Remove redundant fields from user collection
        $unset: {
          verification_images: "",
          documentType: ""
        }
      }
    );

    return NextResponse.json({
      message: "Identity verification submitted",
    });
  } catch (error) {
    console.error("Error submitting identity verification:", error);
    return NextResponse.json({ error: "Failed to submit verification" }, { status: 500 });
  }
}
