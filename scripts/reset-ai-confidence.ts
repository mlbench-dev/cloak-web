import { getDb } from "@/lib/mongodb";

async function main() {
  const db = await getDb();
  const result = await db.collection("reports").updateMany(
    { status: "PENDING" },
    {
      $set: {
        aiConfidence: 0,
        aiConfidenceStatus: "pending",
        aiConfidenceAttempts: 0,
      },
      $unset: {
        aiConfidenceSource: "",
        aiConfidenceMessage: "",
        aiConfidenceLastAttemptAt: "",
      },
    },
  );

  console.log(`Reset ${result.modifiedCount} report(s) for recomputation.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
