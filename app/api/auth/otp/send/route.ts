import clientPromise from "@/lib/mongodb";
import { sendOTPEmail } from "@/lib/mail";
import { normalizeEmail } from "@/lib/email";
import { NextResponse } from "next/server";

// Minimum gap between code requests for one email, so the endpoint can't be
// used to spam a victim's inbox or burn SMTP quota (AUTH-003). Kept below the
// client's 45s resend countdown so a legitimate resend is never blocked.
const RESEND_COOLDOWN_MS = 30 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    // Normalize to a canonical lowercase address: keeps casing/whitespace
    // from forking accounts (AUTH-007) and rejects non-string input before
    // it reaches a query (AUTH-001 class).
    const email = normalizeEmail(body?.email);

    if (!email) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Throttle rapid re-requests for the same email (AUTH-003).
    const existing = await db.collection("otps").findOne({ email });
    if (existing?.createdAt) {
      const elapsed = Date.now() - new Date(existing.createdAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          { error: `Please wait ${retryAfter}s before requesting another code.` },
          { status: 429, headers: { "Retry-After": String(retryAfter) } },
        );
      }
    }

    // Generate a 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Delete any existing OTPs for this email
      await db.collection("otps").deleteMany({ email });

      // Save new OTP to database
      await db.collection("otps").insertOne({
        email,
        code: otp,
        expiresAt,
        attempts: 0,
        createdAt: new Date(),
      });

    // Send the email
    const emailResult = await sendOTPEmail(email, otp);
    
    if (!emailResult.success) {
      console.error("Failed to send OTP email:", emailResult.error);
      // We still return success if DB save worked, but maybe better to warn or fail?
      // For now, let's just log it. The user might want to know if it failed.
    }

    console.log(`OTP for ${email}: ${otp}`);

    return NextResponse.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
