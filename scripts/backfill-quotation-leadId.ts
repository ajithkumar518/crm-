/**
 * Backfill script: populate Quotation.leadId for existing quotations.
 *
 * Strategy:
 *   1. If a quotation has a dealId, look for a Lead whose convertedOpportunityId = dealId.
 *   2. If a quotation has no dealId but has a customerId, look for a Lead whose
 *      convertedAccountId = customerId (lead was converted to a customer account).
 *   3. Otherwise, the quotation is unresolvable — report it.
 *
 * Run: npx tsx scripts/backfill-quotation-leadId.ts
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

async function main() {
  const quotations = await prisma.quotation.findMany({
    where: { leadId: null },
    select: { id: true, quotationCode: true, dealId: true, customerId: true },
  });

  console.log(`\n=== Quotation leadId Backfill ===`);
  console.log(`Total quotations with null leadId: ${quotations.length}\n`);

  let updated = 0;
  let unresolvable = 0;
  const unresolvableList: string[] = [];

  for (const q of quotations) {
    let leadId: string | null = null;

    // Strategy 1: via dealId → Lead.convertedOpportunityId
    if (q.dealId) {
      const lead = await prisma.lead.findFirst({
        where: { convertedOpportunityId: q.dealId, deletedAt: null },
        select: { id: true },
      });
      if (lead) leadId = lead.id;
    }

    // Strategy 2: via customerId → Lead.convertedAccountId
    if (!leadId && q.customerId) {
      const lead = await prisma.lead.findFirst({
        where: { convertedAccountId: q.customerId, deletedAt: null },
        select: { id: true },
      });
      if (lead) leadId = lead.id;
    }

    if (leadId) {
      await prisma.quotation.update({ where: { id: q.id }, data: { leadId } });
      updated++;
      console.log(`[OK]   ${q.quotationCode} → leadId=${leadId}`);
    } else {
      unresolvable++;
      unresolvableList.push(q.quotationCode);
      console.log(`[SKIP] ${q.quotationCode} — no traceable lead (dealId=${q.dealId || "null"}, customerId=${q.customerId})`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total scanned:     ${quotations.length}`);
  console.log(`Updated (backfilled): ${updated}`);
  console.log(`Unresolvable:      ${unresolvable}`);
  if (unresolvableList.length > 0) {
    console.log(`\nUnresolvable quotation codes:`);
    for (const code of unresolvableList) console.log(`  - ${code}`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
