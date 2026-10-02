import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  MAX_SUPPORT_MESSAGE_LENGTH,
  MAX_SUPPORT_SUBJECT_LENGTH,
  PLAN_LIMITS,
} from "@/lib/config";
import { sendSupportEmail } from "@/lib/mail";
import type { PlanCode } from "@/models/Subscription";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const subject = String(body?.subject || "").trim();
    const message = String(body?.message || "").trim();

    if (!subject) {
      return NextResponse.json(
        { error: "Please add a subject before sending." },
        { status: 400 },
      );
    }
    if (subject.length > MAX_SUPPORT_SUBJECT_LENGTH) {
      return NextResponse.json(
        { error: `Subject must be ${MAX_SUPPORT_SUBJECT_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }
    if (!message) {
      return NextResponse.json(
        { error: "Please describe the problem before sending." },
        { status: 400 },
      );
    }
    if (message.length > MAX_SUPPORT_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_SUPPORT_MESSAGE_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }

    const db = await getDb();
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { email: 1, name: 1, username: 1, plan: 1 } },
    );
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Contact Support is a Cloak Pro perk — enforced here regardless of
    // what the client-side menu gate already did, same pattern as
    // canPostCommunity in POST /api/community/posts.
    const plan = (user.plan as PlanCode) || "FREEMIUM";
    if (!PLAN_LIMITS[plan].canContactSupport) {
      return NextResponse.json(
        {
          error: "Contact Support is a Cloak Pro perk. Upgrade to Cloak Pro to reach our team directly.",
          upgradeTo: ["CLOAK_PRO"],
        },
        { status: 403 },
      );
    }

    const result = await sendSupportEmail({
      fromEmail: user.email,
      fromName: user.name,
      username: user.username,
      subject,
      message,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "We couldn't send your message. Please try again shortly." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending support request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
