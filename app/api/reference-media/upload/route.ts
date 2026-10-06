import clientPromise from "@/lib/mongodb";
import { uploadFileToFirebase } from "@/lib/firebaseUtils";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP files are allowed." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size too large. Maximum 10MB allowed." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);
    const user = await db.collection("users").findOne(
      { _id: userId },
      { projection: { identityVerificationStatus: 1 } }
    );

    // Check how many images user already has and find available positions
    const existingMedia = await db.collection("referenceMedia").find({
      userId,
      status: "active"
    }).toArray();

    const existingPositions = existingMedia.map(m => m.position).filter(p => p !== undefined && p !== null);
    
    // Find the first available position (1-3)
    let position = 1;
    for (let i = 1; i <= 3; i++) {
      if (!existingPositions.includes(i)) {
        position = i;
        break;
      }
      position = i + 1;
    }

    if (position > 3) {
      return NextResponse.json(
        { error: "Maximum 3 reference images allowed." },
        { status: 400 }
      );
    }

    // Upload to Firebase Storage
    const filename = `${uuidv4()}_${file.name}`;
    const storagePath = `reference-media/${userId.toString()}/${filename}`;
    const downloadURL = await uploadFileToFirebase(file, storagePath);

    // Insert into database
    const result = await db.collection("referenceMedia").insertOne({
      userId,
      imageUrl: downloadURL,
      storagePath,
      status: "active",
      verificationStatus: "pending",
      position,
      uploadedAt: new Date(),
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }
    });

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

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        imageUrl: downloadURL,
        verificationStatus: "pending",
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error uploading protected media:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
