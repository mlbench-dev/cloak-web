import clientPromise from "@/lib/mongodb";
import { calculateLevel, initializeUserAchievements } from "@/lib/achievements";
import { XP_CONFIG } from "@/lib/config";
import { normalizeEmail } from "@/lib/email";
import { issueLoginToken } from "@/lib/loginToken";
import { NextResponse } from "next/server";

// Most wrong guesses allowed against one issued code before it's burned and
// the user has to request a new one — blocks brute force of the 4-digit code
// (AUTH-002).
const MAX_OTP_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    // Coerce to the exact types we expect BEFORE anything touches a query.
    // Previously `code` was passed straight into findOne({ email, code }),
    // so a JSON value like { "$ne": "x" } became a Mongo operator and
    // matched any stored OTP — a full auth bypass (AUTH-001). Emails are
    // normalized so casing/whitespace can't fork accounts (AUTH-007).
    const email = normalizeEmail(body?.email);
    const code =
      typeof body?.code === "string" ? body.code.trim() : null;

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    // Only a 4-digit numeric string is ever a valid code; reject anything
    // else outright so malformed input can't reach the lookup.
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json(
        { error: "Invalid code. Please check and try again." },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const now = new Date();

    // Look the OTP up by email alone (one active code per email — otp/send
    // deletes prior ones), then compare the code in application code. This
    // lets us (a) count failed attempts for lockout and (b) tell "expired"
    // apart from "wrong code" without ever putting user input in the query.
    const record = await db.collection("otps").findOne({ email });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid code. Please check and try again." },
        { status: 400 },
      );
    }

    if (record.expiresAt <= now) {
      await db.collection("otps").deleteMany({ email });
      return NextResponse.json(
        { error: "This code has expired. Please request a new one." },
        { status: 400 },
      );
    }

    if (record.code !== code) {
      // Burn the code once too many wrong guesses pile up, so an attacker
      // can't keep trying all 10,000 combinations against one issued code.
      const attempts = (typeof record.attempts === "number" ? record.attempts : 0) + 1;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await db.collection("otps").deleteMany({ email });
        return NextResponse.json(
          { error: "Too many incorrect attempts. Please request a new code." },
          { status: 400 },
        );
      }
      await db
        .collection("otps")
        .updateOne({ _id: record._id }, { $set: { attempts } });
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

    // Redeemed by the credentials provider's authorize() — the only thing
    // that lets the client turn this verification into a session.
    const loginToken = await issueLoginToken(db, email);

    return NextResponse.json({
      message: "OTP verified successfully",
      loginToken,
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
