/**
 * Test script: Create test quotations and walk them through all 13 spec statuses.
 * Verifies that each status can be set and read back correctly.
 *
 * Run with: npx tsx scripts/test-all-quotation-statuses.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Quotation Status Test ===\n");

  // Find a company and user to test with
  const company = await prisma.company.findFirst();
  if (!company) { console.error("No company found"); return; }
  const user = await prisma.user.findFirst({ where: { companyId: company.id, isActive: true } });
  if (!user) { console.error("No active user found"); return; }
  const customer = await prisma.customer.findFirst({ where: { companyId: company.id, deletedAt: null } });
  if (!customer) { console.error("No customer found"); return; }

  console.log(`Company: ${company.name} | User: ${user.name} | Customer: ${customer.name}\n`);

  // Check current status distribution
  const statusCounts = await prisma.quotation.groupBy({
    by: ["status"],
    where: { companyId: company.id, deletedAt: null },
    _count: { status: true },
  });
  console.log("Current quotation status distribution:");
  statusCounts.forEach(s => console.log(`  ${s.status}: ${s._count.status}`));
  console.log();

  // Create a test quotation
  const testQuote = await prisma.quotation.create({
    data: {
      quotationCode: `TEST-STATUS-${Date.now()}`,
      customerId: customer.id,
      companyId: company.id,
      createdById: user.id,
      status: "Draft",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      totalAmount: 1000,
      finalAmount: 1180,
      paymentTerms: "30 days",
      deliveryTerms: "Ex-Works",
      termsAndConditions: "Test T&C",
    },
  });
  console.log(`Created test quotation: ${testQuote.quotationCode} (id: ${testQuote.id})\n`);

  const specStatuses = [
    "Draft",
    "Quotation Sent",
    "Follow-up",
    "Revised Rate",
    "Accepted",
    "Rejected",
    "MOQ",
    "Material Not Available",
    "No Stock",
    "Price Pending",
    "Supplier Rate Checking",
    "Converted to Customer",
    "Others",
  ];

  let passCount = 0;
  let failCount = 0;

  for (const status of specStatuses) {
    try {
      // Update quotation status
      await prisma.quotation.update({
        where: { id: testQuote.id },
        data: { status },
      });

      // Read back and verify
      const updated = await prisma.quotation.findUnique({
        where: { id: testQuote.id },
        select: { status: true },
      });

      if (updated?.status === status) {
        console.log(`  PASS: ${status}`);
        passCount++;
      } else {
        console.log(`  FAIL: ${status} — got ${updated?.status}`);
        failCount++;
      }

      // Log status history
      await prisma.quotationStatusHistory.create({
        data: {
          quotationId: testQuote.id,
          fromStatus: "Draft",
          toStatus: status,
          changedById: user.id,
          notes: `Test: set to ${status}`,
        },
      });
    } catch (e: any) {
      console.log(`  ERROR: ${status} — ${e.message}`);
      failCount++;
    }
  }

  console.log(`\n=== Results: ${passCount} passed, ${failCount} failed ===\n`);

  // Verify dashboard queries will return non-zero for each status
  console.log("Dashboard query verification (per status):");
  for (const status of specStatuses) {
    const count = await prisma.quotation.count({
      where: { companyId: company.id, deletedAt: null, status },
    });
    console.log(`  ${status}: ${count} quotation(s)`);
  }

  // Clean up — delete the test quotation
  await prisma.quotation.delete({ where: { id: testQuote.id } });
  console.log(`\nCleaned up test quotation ${testQuote.quotationCode}`);
}

main()
  .catch((e) => { console.error("Test failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
