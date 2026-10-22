import { createHash, randomBytes } from "crypto";
import type { Db } from "mongodb";

// One-time proof that an email's OTP was just verified. otp/verify issues
// it; the NextAuth credentials provider redeems it. Without it, posting an
// email to /api/auth/callback/credentials alone was enough to get a session
// for any account.

const COLLECTION = "loginTokens";
// Only needs to survive the hop from otp/verify to signIn().
const LOGIN_TOKEN_TTL_MS = 2 * 60 * 1000;

// Only the hash is stored, so a database read can't be turned into a login.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueLoginToken(db: Db, email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  // One live token per email.
  await db.collection(COLLECTION).deleteMany({ email });
  await db.collection(COLLECTION).insertOne({
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
    createdAt: new Date(),
  });
  return token;
}

// Single use: the matching token is deleted in the same operation that
// checks it, so it can't be replayed.
export async function redeemLoginToken(db: Db, email: string, token: unknown): Promise<boolean> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const redeemed = await db.collection(COLLECTION).findOneAndDelete({
    email,
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  return redeemed !== null;
}
