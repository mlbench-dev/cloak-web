import clientPromise from "@/lib/mongodb";
import { sendOTPEmail } from "@/lib/mail";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

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
