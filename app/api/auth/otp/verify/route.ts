import clientPromise from "@/lib/mongodb";
import { initializeUserAchievements } from "@/lib/achievements";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const now = new Date();
    console.log("OTP Verification Attempt:", { email, code, currentTime: now });

    const otpRecord = await db.collection("otps").findOne({
      email,
      code,
      expiresAt: { $gt: now },
    });

    console.log("Found OTP Record:", otpRecord);

    if (!otpRecord) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // Delete the OTP after successful verification
    await db.collection("otps").deleteMany({ email });

    // Check if user exists, if not create a placeholder
    let user = await db.collection("users").findOne({ email });

    if (!user) {
      const result = await db.collection("users").insertOne({
        email,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isVerified: false,
        identityVerificationStatus: null,
        role: "USER", // Default role
        points: 0,
        level: 1,
        totalReports: 0,
        verifiedReports: 0,
        accuracyPercentage: 0,
        achievements: initializeUserAchievements(),
      });
      user = { _id: result.insertedId, email, isVerified: false, identityVerificationStatus: null, role: "USER" };
    } else {
      const updateData: any = {
        emailVerified: new Date(),
        updatedAt: new Date(),
      };

      // Initialize missing fields in case user was created before these were added
      if (typeof user.points !== "number") updateData.points = 0;
      if (typeof user.level !== "number") updateData.level = 1;
      if (typeof user.totalReports !== "number") updateData.totalReports = 0;
      if (typeof user.verifiedReports !== "number") updateData.verifiedReports = 0;
      if (typeof user.accuracyPercentage !== "number") updateData.accuracyPercentage = 0;
      if (!Array.isArray(user.achievements)) updateData.achievements = initializeUserAchievements();

      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: updateData }
      );
    }

    return NextResponse.json({
      message: "OTP verified successfully",
      user: {
        id: user._id.toString(),
        email: user.email,
        username: (user as any).username,
        isVerified: (user as any).isVerified || false,
        identityVerificationStatus: (user as any).identityVerificationStatus || null,
        role: (user as any).role,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 });
  }
}
