/**
 * List all 16 blocked Quotations with customer details for review.
 */
import { prisma } from "../lib/prisma";
import { resolveTaxTreatment, getStateCodeFromGstin } from "../lib/gstState";

async function main() {
  const gstinConfig = await prisma.systemConfig.findUnique({ where: { key: "company_gstin" } });
  const companyGstin = gstinConfig?.value || null;

  const quotations = await prisma.quotation.findMany({
    where: { deletedAt: null },
    include: {
      customer: { select: { name: true, customerCode: true, state: true, gstNumber: true, city: true, phone: true } },
      items: { select: { description: true } },
    },
    orderBy: { quotationCode: "asc" },
  });

  console.log("=".repeat(120));
  console.log("BLOCKED QUOTATIONS — Missing State/GSTIN Data");
  console.log("=".repeat(120));
  console.log(`Supplier GSTIN: ${companyGstin} → State: ${getStateCodeFromGstin(companyGstin)} (Tamil Nadu)`);
  console.log();

  const blocked: any[] = [];
  for (const q of quotations) {
    const result = resolveTaxTreatment(
      companyGstin,
      q.customer?.state || null,
      q.customer?.gstNumber || null,
      q.customer?.state || null,
      q.customer?.gstNumber || null,
      q.customer?.state || null,
    );
    if (result.treatment === "unknown") {
      blocked.push(q);
    }
  }

  console.log(`Total blocked: ${blocked.length} of ${quotations.length} quotations`);
  console.log();

  const isJunk = (name: string) => {
    const junkPatterns = ["sdcv", "lkjhg", "asdfgh", "test", "Test", "EXAMPLE", "example", "dsfg", "fdsa"];
    return junkPatterns.some(p => name?.includes(p));
  };

  console.log("─".repeat(120));
  console.log("REAL (likely needs fixing):");
  console.log("─".repeat(120));
  for (const q of blocked) {
    if (!isJunk(q.customer?.name)) {
      console.log(`  ${q.quotationCode} R${q.revisionNumber} | Status: ${q.status.padEnd(20)} | Customer: ${q.customer?.name} (${q.customer?.customerCode}) | City: ${q.customer?.city || "—"} | State: ${q.customer?.state || "NULL"} | GSTIN: ${q.customer?.gstNumber || "NULL"}`);
    }
  }

  console.log();
  console.log("─".repeat(120));
  console.log("LIKELY JUNK/TEST DATA (candidate for deletion):");
  console.log("─".repeat(120));
  for (const q of blocked) {
    if (isJunk(q.customer?.name)) {
      console.log(`  ${q.quotationCode} R${q.revisionNumber} | Status: ${q.status.padEnd(20)} | Customer: ${q.customer?.name} (${q.customer?.customerCode}) | State: ${q.customer?.state || "NULL"} | GSTIN: ${q.customer?.gstNumber || "NULL"}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
