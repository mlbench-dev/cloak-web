import { loadEnvConfig } from "@next/env";
import { getDb } from "@/lib/mongodb";

// Load .env.local (and the other .env files) the same way Next does, so this
// can be run directly with `npx tsx` without exporting DATABASE_URL by hand.
// lib/mongodb reads the env lazily on first connect, so this just needs to
// run before main() calls getDb() — which it does, at module load.
loadEnvConfig(process.cwd());

// One-off migration for AUTH-007: emails are now stored and matched in
// canonical lowercase (see lib/email.ts). Existing rows created before that
// may hold mixed-case addresses, which would no longer be found by the
// normalized lookups — locking those users out or forking a new account on
// their next login. This lowercases existing emails across the collections
// that key off them.
//
// Collision handling: if lowercasing an email would collide with an account
// that already owns the lowercase form, the duplicate is NOT merged here
// (merging accounts is a product decision — reports, subscriptions, XP, etc.
// would have to be reconciled). Such rows are reported and left untouched so
// a human can decide. Run with:  npx tsx scripts/migrate-email-lowercase.ts
async function main() {
  const db = await getDb();
  const users = db.collection("users");

  const mixedCase = await users
    .find({ email: { $type: "string" } })
    .project({ email: 1 })
    .toArray();

  let updated = 0;
  const collisions: Array<{ id: string; email: string; lower: string }> = [];

  for (const user of mixedCase) {
    const email: string = user.email;
    const lower = email.trim().toLowerCase();
    if (lower === email) continue; // already canonical

    // Would this collide with a different account that already holds the
    // lowercase address?
    const clash = await users.findOne(
      { email: lower, _id: { $ne: user._id } },
      { projection: { _id: 1 } },
    );
    if (clash) {
      collisions.push({ id: user._id.toString(), email, lower });
      continue;
    }

    await users.updateOne({ _id: user._id }, { $set: { email: lower } });
    // Keep the OTP ledger consistent (it keys on email).
    await db.collection("otps").updateMany({ email }, { $set: { email: lower } });
    updated += 1;
  }

  console.log(`Lowercased ${updated} user email(s).`);
  if (collisions.length > 0) {
    console.warn(
      `Skipped ${collisions.length} email(s) that would collide with an existing lowercase account — resolve these manually:`,
    );
    for (const c of collisions) {
      console.warn(`  ${c.id}: "${c.email}" -> "${c.lower}" (already taken)`);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
