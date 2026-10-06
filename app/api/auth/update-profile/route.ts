import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { userId, username, profileImage, image, name } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const updateData: any = {
      updatedAt: new Date(),
    };
    if (username) updateData.username = username;
    if (profileImage) updateData.profileImage = profileImage;
    if (image) updateData.image = image;
    if (name) updateData.name = String(name).slice(0, 30);

    // Check for username uniqueness if being updated
    if (username) {
      const existingUser = await db.collection("users").findOne({
        username,
        _id: { $ne: new ObjectId(userId) },
      });
      if (existingUser) {
        return NextResponse.json({ error: "Username already taken" }, { status: 400 });
      }
    }

    const result = await db.collection("users").findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: updateData },
      { returnDocument: "after", projection: { googleId: 0 } }
    );

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result;

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: user._id.toString(),
        email: user.email,
        username: (user as any).username,
        profileImage: (user as any).profileImage || (user as any).image,
        image: (user as any).image,
        name: (user as any).name,
        isVerified: (user as any).isVerified,
        role: (user as any).role,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
