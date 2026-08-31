/**
 * Cleanup leftover test data from Phases 0-4.
 * Removes: VERIFY-* quotations, QT-REAL-002, test InboundEmailLogs.
 * Cascade-deletes child records (items, histories, etc.).
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

async function main() {
  const testQuotations = await prisma.quotation.findMany({
    where: { OR: [{ quotationCode: { startsWith: "VERIFY-" } }, { quotationCode: "QT-REAL-002" }] },
    select: { id: true, quotationCode: true },
  });
  console.log(`Found ${testQuotations.length} test quotations to remove:`);
  testQuotations.forEach(q => console.log(`  - ${q.quotationCode}`));

  for (const q of testQuotations) {
    // Delete child records first (relations that don't cascade)
    try { await prisma.quotationStatusHistory.deleteMany({ where: { quotationId: q.id } }); } catch {}
    try { await prisma.quotationRevisionSnapshot.deleteMany({ where: { quotationId: q.id } }); } catch {}
    try { await prisma.quotationApproval.deleteMany({ where: { quotationId: q.id } }); } catch {}
    try { await prisma.quotationItem.deleteMany({ where: { quotationId: q.id } }); } catch {}
    // Negotiation links
    try { await prisma.negotiation.deleteMany({ where: { quotationId: q.id } }); } catch {}
    // Proforma linked to this quotation
    try { await prisma.proformaInvoiceItem.deleteMany({ where: { proforma: { quotationId: q.id } } }); } catch {}
    try { await prisma.proformaInvoiceHistory.deleteMany({ where: { proforma: { quotationId: q.id } } }); } catch {}
    try { await prisma.proformaInvoice.deleteMany({ where: { quotationId: q.id } }); } catch {}
    // SalesOrder linked
    try { await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { quotationId: q.id } } }); } catch {}
    try { await prisma.salesOrder.deleteMany({ where: { quotationId: q.id } }); } catch {}
    // PurchaseOrder linked
    try { await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { quotationId: q.id } } }); } catch {}
    try { await prisma.purchaseOrder.deleteMany({ where: { quotationId: q.id } }); } catch {}
    // Finally delete the quotation
    await prisma.quotation.delete({ where: { id: q.id } });
    console.log(`  Deleted ${q.quotationCode}`);
  }

  // Test InboundEmailLogs
  const testEmails = await prisma.inboundEmailLog.findMany({
    where: { OR: [{ subject: { contains: "DUPLICATE TEST" } }, { subject: { contains: "TEST EMAIL" } }, { fromEmail: { contains: "testcompany.com" } }] },
    select: { id: true, subject: true },
  });
  console.log(`\nFound ${testEmails.length} test InboundEmailLogs to remove:`);
  testEmails.forEach(e => console.log(`  - ${e.subject}`));
  for (const e of testEmails) {
    await prisma.inboundEmailLog.delete({ where: { id: e.id } });
    console.log(`  Deleted: ${e.subject}`);
  }

  console.log("\nCleanup complete.");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
