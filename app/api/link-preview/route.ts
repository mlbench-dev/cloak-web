import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ success: true, preview: null });
    }

    // Simple preview without external dependencies
    const preview = {
      url: url,
      domain: new URL(url).hostname,
    };

    return NextResponse.json({ success: true, preview });
  } catch (error) {
    console.error("Error fetching link preview:", error);
    return NextResponse.json({ success: true, preview: null });
  }
}