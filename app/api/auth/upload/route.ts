import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { uploadFileToFirebase } from "@/lib/firebaseUtils";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // 'profile' or 'identity'
    const userId = formData.get("userId") as string;

    if (!file || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const filename = `${uuidv4()}_${file.name}`;
    const storagePath = `uploads/${type === "profile" ? "profile_images" : "identity_documents"}/${userId}/${filename}`;
    
    // Upload to Firebase Storage instead of local filesystem
    const downloadURL = await uploadFileToFirebase(file, storagePath);

    return NextResponse.json({ url: downloadURL });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
