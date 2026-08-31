/**
 * Creates one test quotation per spec status and leaves them in the DB
 * so the dashboard KPIs show non-zero values for verification.
 *
 * Run with: npx tsx scripts/seed-test-status-quotations.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) { console.error("No company"); return; }
  const user = await prisma.user.findFirst({ where: { companyId: company.id, isActive: true } });
  if (!user) { console.error("No user"); return; }
  const customer = await prisma.customer.findFirst({ where: { companyId: company.id, deletedAt: null } });
  if (!customer) { console.error("No customer"); return; }

  const specStatuses = [
    "Draft", "Quotation Sent", "Follow-up", "Revised Rate", "Accepted",
    "Rejected", "MOQ", "Material Not Available", "No Stock",
    "Price Pending", "Supplier Rate Checking", "Converted to Customer", "Others",
  ];

  console.log(`Creating ${specStatuses.length} test quotations (one per status)...\n`);

  for (const status of specStatuses) {
    const code = `VERIFY-${status.replace(/\s+/g, "-")}-${Date.now()}`;
    const q = await prisma.quotation.create({
      data: {
        quotationCode: code,
        customerId: customer.id,
        companyId: company.id,
        createdById: user.id,
        status,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalAmount: 1000,
        finalAmount: 1180,
        paymentTerms: "30 days",
        deliveryTerms: "Ex-Works",
        termsAndConditions: "Verification test",
      },
    });
    await prisma.quotationStatusHistory.create({
      data: {
        quotationId: q.id,
        fromStatus: "Draft",
        toStatus: status,
        changedById: user.id,
        notes: `Verification seed: ${status}`,
      },
    });
    console.log(`  Created ${code} → ${status}`);
  }

  // Verify dashboard queries
  console.log("\nDashboard query verification:");
  const dashQueries = [
    { label: "Quotations Sent", status: "Quotation Sent" },
    { label: "Follow-up Pending", status: "Follow-up" },
    { label: "Converted Customers", status: "Converted to Customer" },
    { label: "Pending Supplier Rate Checking", status: "Supplier Rate Checking" },
    { label: "Material Not Available Cases", status: "Material Not Available" },
    { label: "No Stock Cases", status: "No Stock" },
  ];
  for (const dq of dashQueries) {
    const count = await prisma.quotation.count({
      where: { companyId: company.id, deletedAt: null, status: dq.status },
    });
    console.log(`  ${dq.label} (status="${dq.status}"): ${count}`);
  }

  console.log("\nDone. Test quotations left in DB for dashboard verification.");
  console.log("Run scripts/cleanup-test-quotations.ts to remove them later.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
