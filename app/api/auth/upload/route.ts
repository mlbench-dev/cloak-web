import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { uploadFileToFirebase } from "@/lib/firebaseUtils";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Owner comes from the session, not a form field. The route used to
    // take `userId` from the request body with no auth, letting anyone
    // upload files into any user's storage path (AUTH-005).
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // 'profile' or 'identity'

    if (!file) {
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
