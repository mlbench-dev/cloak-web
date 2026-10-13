import { getDb } from "@/lib/mongodb";

// One-off: the Boost Protection plan was removed. Moves anyone still on it
// back to Freemium so no stored "BOOST" plan code is left behind. Safe to
// re-run — once nothing matches plan "BOOST" it's a no-op.
//
// This only updates our own database. It does NOT cancel anything on
// PayFast — any real recurring Boost subscription there has to be
// cancelled from the PayFast dashboard (see docs/subscription-admin-runbook.md).
async function main() {
  const db = await getDb();
  const now = new Date();

  const users = await db
    .collection("users")
    .updateMany(
      { plan: "BOOST" },
      { $set: { plan: "FREEMIUM", updatedAt: now } },
    );

  // Close the subscription out rather than deleting it, so the billing
  // history stays. Ending the period now means resolveUserPlan treats it as
  // expired immediately, and a stray PayFast renewal for it would only ever
  // write back FREEMIUM.
  const subscriptions = await db.collection("subscriptions").updateMany(
    { plan: "BOOST" },
    {
      $set: {
        plan: "FREEMIUM",
        status: "CANCELLED",
        cancelAtPeriodEnd: true,
        cancelledAt: now,
        currentPeriodEnd: now,
        updatedAt: now,
      },
    },
  );

  console.log(
    `Moved ${users.modifiedCount} user(s) and ${subscriptions.modifiedCount} subscription(s) from BOOST to FREEMIUM.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Boost migration failed:", error);
  process.exit(1);
});
