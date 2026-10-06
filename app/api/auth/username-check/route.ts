import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    const existingUser = await db.collection("users").findOne({
      username: username.toLowerCase(),
    });

    return NextResponse.json({ available: !existingUser });
  } catch (error) {
    console.error("Error checking username availability:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
