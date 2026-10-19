import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();

    const verification = await db
      .collection("identityVerifications")
      .findOne(
        { userId: new ObjectId(session.user.id) },
        { sort: { updatedAt: -1 } },
      );

    return NextResponse.json({
      documentType: verification?.documentType || null,
      documentUrls: Array.isArray(verification?.verification_images)
        ? verification.verification_images
        : [],
      status: verification?.status || null,
      verificationInProgress: Boolean(verification?.verificationInProgress),
      verificationResult: verification?.verificationResult || null,
      verificationFailureReason:
        verification?.verificationFailureReason || null,
      verificationHistory: Array.isArray(verification?.verificationHistory)
        ? verification.verificationHistory
            .slice(-5)
            .reverse()
            .map((entry) => ({
              status: entry?.status || null,
              reason: entry?.reason || null,
            }))
        : [],
    });
  } catch (error) {
    console.error("Error fetching identity verification:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    // Identity comes from the session, not the request body. The route used
    // to trust a body `userId` with no auth, so anyone could submit identity
    // documents and flip verification state for any user (AUTH-006). The GET
    // handler on this route already authenticates — this matches it.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const { documentType, documentUrls } = await request.json();

    if (
      !documentType ||
      !documentUrls ||
      !Array.isArray(documentUrls)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db();

    // Check if there's an existing verification for this user
    const existingVerification = await db
      .collection("identityVerifications")
      .findOne({
        userId: new ObjectId(userId),
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
            verificationInProgress: false,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      // Create new verification
      await db.collection("identityVerifications").insertOne({
        userId: new ObjectId(userId),
        documentType,
        verification_images: documentUrls,
        status: "PENDING",
        verificationInProgress: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Update only the status in user collection (not the full data)
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          identityVerificationStatus: "PENDING",
          updatedAt: new Date(),
        },
        // Remove redundant fields from user collection
        $unset: {
          verification_images: "",
          documentType: "",
        },
      },
    );

    return NextResponse.json({
      message: "Identity verification submitted",
    });
  } catch (error) {
    console.error("Error submitting identity verification:", error);
    return NextResponse.json(
      { error: "Failed to submit verification" },
      { status: 500 },
    );
  }
}
