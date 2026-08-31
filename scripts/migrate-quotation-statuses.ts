/**
 * Migration script: Update old quotation status values to spec-compliant values.
 *
 * Run with: npx tsx scripts/migrate-quotation-statuses.ts
 *
 * Changes:
 *   "Sent" → "Quotation Sent"
 *
 * Also updates QuotationStatusHistory.fromStatus/toStatus for consistency.
 * Other system statuses (Approved, UnderReview, PendingApproval, Expired, OnHold)
 * are kept as-is since they are internal workflow states not in the spec 13,
 * but they coexist fine with the spec statuses.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Quotation Status Migration ===\n");

  // 1. Update Quotation.status: "Sent" → "Quotation Sent"
  const quotesUpdated = await prisma.quotation.updateMany({
    where: { status: "Sent" },
    data: { status: "Quotation Sent" },
  });
  console.log(`Updated ${quotesUpdated.count} quotation(s): "Sent" → "Quotation Sent"`);

  // 2. Update QuotationStatusHistory.fromStatus: "Sent" → "Quotation Sent"
  const fromStatusUpdated = await prisma.quotationStatusHistory.updateMany({
    where: { fromStatus: "Sent" },
    data: { fromStatus: "Quotation Sent" },
  });
  console.log(`Updated ${fromStatusUpdated.count} status history fromStatus: "Sent" → "Quotation Sent"`);

  // 3. Update QuotationStatusHistory.toStatus: "Sent" → "Quotation Sent"
  const toStatusUpdated = await prisma.quotationStatusHistory.updateMany({
    where: { toStatus: "Sent" },
    data: { toStatus: "Quotation Sent" },
  });
  console.log(`Updated ${toStatusUpdated.count} status history toStatus: "Sent" → "Quotation Sent"`);

  // 4. Update QuotationRevisionSnapshot if it stores status in snapshotJson
  // (We can't easily parse JSON here, but the snapshots are historical records
  //  and don't affect filtering. Skip for now.)

  console.log("\n=== Migration Complete ===");
  console.log("Note: System statuses (Approved, UnderReview, PendingApproval, Expired, OnHold) are kept as-is.");
  console.log("These are internal workflow states that coexist with the spec 13 statuses.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
