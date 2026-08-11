import clientPromise from "@/lib/mongodb";
import { calculateLevel, initializeUserAchievements } from "@/lib/achievements";
import { XP_CONFIG } from "@/lib/config";
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

    // Look up the code regardless of expiry first so we can tell the user
    // *why* it failed — "your code expired, request a new one" is a very
    // different next step from "you mistyped the code."
    const matchingRecord = await db.collection("otps").findOne({ email, code });

    console.log("Found OTP Record:", matchingRecord);

    if (matchingRecord && matchingRecord.expiresAt <= now) {
      await db.collection("otps").deleteMany({ email });
      return NextResponse.json(
        { error: "This code has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const otpRecord =
      matchingRecord && matchingRecord.expiresAt > now ? matchingRecord : null;

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid code. Please check and try again." },
        { status: 400 },
      );
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
        plan: "FREEMIUM",
        xp: 0,
        level: 0,
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

      // Initialize missing fields in case user was created before these were
      // added (pre-migration legacy users). XP is backfilled from approved
      // report history rather than reset to 0, so existing users don't lose
      // visible progress.
      if (typeof user.verifiedReports !== "number") updateData.verifiedReports = 0;
      if (typeof user.xp !== "number") {
        const verifiedReports =
          typeof updateData.verifiedReports === "number"
            ? updateData.verifiedReports
            : user.verifiedReports;
        updateData.xp = verifiedReports * XP_CONFIG.REPORT_APPROVED;
      }
      if (typeof user.level !== "number") {
        updateData.level = calculateLevel(updateData.xp ?? user.xp ?? 0).currentLevel;
      }
      if (typeof user.totalReports !== "number") updateData.totalReports = 0;
      if (typeof user.accuracyPercentage !== "number") updateData.accuracyPercentage = 0;
      if (!Array.isArray(user.achievements)) updateData.achievements = initializeUserAchievements();
      if (typeof user.plan !== "string") updateData.plan = "FREEMIUM";

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
        plan: (user as any).plan || "FREEMIUM",
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 });
  }
}
