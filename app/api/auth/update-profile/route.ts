import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Keep these in sync with the client (app/components/auth/UsernameStep.tsx):
// 3–20 chars, lowercase letters / digits / underscore only. Enforced here
// too so the rules can't be bypassed by calling the API directly (PROF-001).
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const MAX_NAME_LENGTH = 30;

export async function POST(request: Request) {
  try {
    // Identity comes from the session, never from the request body. The
    // route used to trust a body `userId`, letting anyone overwrite any
    // user's profile without authenticating (AUTH-004 / IDOR).
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = new ObjectId(session.user.id);

    const body = await request.json().catch(() => null);
    const { username, profileImage, image, name } = body ?? {};

    const client = await clientPromise;
    const db = client.db();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Normalize + validate the username the same way the UI does, so a
    // direct API call can't store spaces, HTML, 1-char or mixed-case names
    // (PROF-001), and so uniqueness is case-insensitive by construction
    // (PROF-002).
    let normalizedUsername: string | undefined;
    if (username !== undefined && username !== null) {
      if (typeof username !== "string") {
        return NextResponse.json({ error: "Invalid username" }, { status: 400 });
      }
      normalizedUsername = username.trim().toLowerCase();
      if (!USERNAME_REGEX.test(normalizedUsername)) {
        return NextResponse.json(
          {
            error:
              "Username must be 3–20 characters, using only lowercase letters, numbers and underscores.",
          },
          { status: 400 },
        );
      }
      updateData.username = normalizedUsername;
    }

    if (typeof profileImage === "string") updateData.profileImage = profileImage;
    if (typeof image === "string") updateData.image = image;
    if (typeof name === "string") updateData.name = name.slice(0, MAX_NAME_LENGTH);

    // Check for username uniqueness if being updated. Stored usernames are
    // always lowercase (above), so an exact match on the normalized value is
    // a reliable case-insensitive check.
    if (normalizedUsername) {
      const existingUser = await db.collection("users").findOne({
        username: normalizedUsername,
        _id: { $ne: userId },
      });
      if (existingUser) {
        return NextResponse.json({ error: "Username already taken" }, { status: 400 });
      }
    }

    const result = await db.collection("users").findOneAndUpdate(
      { _id: userId },
      { $set: updateData },
      { returnDocument: "after", projection: { googleId: 0 } }
    );

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result as {
      _id: ObjectId;
      email?: string;
      username?: string;
      profileImage?: string;
      image?: string;
      name?: string;
      isVerified?: boolean;
      role?: string;
    };

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        profileImage: user.profileImage || user.image,
        image: user.image,
        name: user.name,
        isVerified: user.isVerified,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
