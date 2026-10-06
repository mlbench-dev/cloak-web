import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAdminAuth } from "@/lib/firebaseAdminAuth";

// Bridges the NextAuth session (this app's real auth) into a short-lived
// Firebase credential, so the browser can sign into Firebase directly and
// prove its identity to Realtime Database's security rules — see
// notificationPings/{userId} in app/components/NotificationsProvider.tsx.
// Firebase's client SDK persists/refreshes its own session after the
// initial signInWithCustomToken(), so this only needs to be called once
// per app load, not per request.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getAdminAuth().createCustomToken(session.user.id);
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error minting Firebase custom token:", error);
    return NextResponse.json(
      { error: "Firebase is not configured" },
      { status: 503 },
    );
  }
}
