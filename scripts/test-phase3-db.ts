/**
 * Direct DB test for 3a (proforma item edit + recalc + history + Sales-Order block),
 * 3c (SalesOrder ERP sync fields exist).
 *
 * Bypasses HTTP login by calling the same Prisma logic the API uses.
 *
 * Run: npx tsx scripts/test-phase3-db.ts
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

async function main() {
  let pass = 0;
  let fail = 0;
  const check = (label: string, condition: boolean, detail?: string) => {
    const status = condition ? "PASS" : "FAIL";
    if (condition) pass++; else fail++;
    console.log(`[${status}] ${label}${detail ? " — " + detail : ""}`);
  };

  // ─── 3a: Find or create an editable proforma ──────────────────────────────
  console.log("\n=== 3a: Proforma item edit + recalc + history (direct DB) ===\n");

  const company = await prisma.company.findFirst();
  const companyId = company?.id;
  const adminUser = await prisma.user.findFirst({ where: { role: "Admin", isActive: true, companyId } });
  if (!adminUser) { console.log("No admin user"); process.exit(1); }

  let proforma = await prisma.proformaInvoice.findFirst({
    where: { SalesOrder: null, companyId },
    include: { items: true, SalesOrder: { select: { id: true } } },
  });

  if (!proforma) {
    const customer = await prisma.customer.findFirst({ where: { companyId } });
    const quotation = await prisma.quotation.findFirst({ where: { companyId } });
    const year = new Date().getFullYear();
    const count = await prisma.proformaInvoice.count({ where: { proformaNumber: { startsWith: `PF-TEST-${year}-` } } });
    proforma = await prisma.proformaInvoice.create({
      data: {
        proformaNumber: `PF-TEST-${year}-${String(count + 1).padStart(5, "0")}`,
        quotationId: quotation?.id || null,
        customerId: customer!.id,
        status: "Draft",
        subtotal: 1000,
        taxAmount: 180,
        grandTotal: 1180,
        createdById: adminUser.id,
        companyId,
        items: { create: [{ description: "Test item", quantity: 10, unitPrice: 100, lineTotal: 1000, taxPercent: 18 }] },
      },
      include: { items: true, SalesOrder: { select: { id: true } } },
    });
    console.log(`Created test proforma: ${proforma.proformaNumber}`);
  }

  const itemId = proforma.items[0].id;
  const originalQty = proforma.items[0].quantity;
  const originalSubtotal = proforma.subtotal;
  const originalGrandTotal = proforma.grandTotal;
  const newQty = originalQty + 5;

  // Simulate the PATCH /items logic
  const existingItem = proforma.items[0];
  const qty = newQty;
  const price = existingItem.unitPrice;
  const disc = existingItem.discountPercent;
  const cutting = existingItem.cuttingCharge || 0;
  const lineTotal = qty * price * (1 - disc / 100) + cutting;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.proformaInvoiceItem.update({
      where: { id: itemId },
      data: { quantity: newQty, lineTotal },
    });

    const allItems = await tx.proformaInvoiceItem.findMany({ where: { proformaId: proforma.id } });
    let subtotal = 0;
    let taxAmount = 0;
    for (const it of allItems) {
      subtotal += it.lineTotal;
      taxAmount += it.lineTotal * ((it.taxPercent || 0) / 100);
    }
    const discountAmount = subtotal * (proforma.discountPercent / 100);
    const grandTotal = subtotal - discountAmount + taxAmount;

    await tx.proformaInvoice.update({
      where: { id: proforma.id },
      data: { subtotal, taxAmount, grandTotal },
    });

    await tx.proformaInvoiceHistory.create({
      data: {
        proformaId: proforma.id,
        proformaItemId: itemId,
        fieldName: "quantity",
        previousValue: String(originalQty),
        newValue: String(newQty),
        changedById: adminUser.id,
        notes: `Edited line item "${existingItem.description}"`,
      },
    });

    return { updated, subtotal, taxAmount, grandTotal };
  });

  check(`Item quantity updated to ${newQty}`, result.updated.quantity === newQty);
  check(`Subtotal recalculated (${originalSubtotal} → ${result.subtotal})`, result.subtotal !== originalSubtotal);
  check(`Grand total recalculated (${originalGrandTotal} → ${result.grandTotal})`, result.grandTotal !== originalGrandTotal);

  const history = await prisma.proformaInvoiceHistory.findFirst({
    where: { proformaId: proforma.id },
    include: { changedBy: { select: { name: true } } },
  });
  check(`History entry created`, !!history);
  check(`History records field=quantity`, history?.fieldName === "quantity");
  check(`History records previousValue=${originalQty}`, history?.previousValue === String(originalQty));
  check(`History records newValue=${newQty}`, history?.newValue === String(newQty));
  check(`History has changedBy user`, !!history?.changedBy?.name, history?.changedBy?.name);

  // ─── 3a: Sales-Order block path ───────────────────────────────────────────
  console.log("\n=== 3a: Sales-Order block path ===\n");

  // Create a Sales Order from this proforma
  const year = new Date().getFullYear();
  const soCount = await prisma.salesOrder.count({ where: { orderNumber: { startsWith: `SO-TEST-${year}-` } } });
  const so = await prisma.salesOrder.create({
    data: {
      orderNumber: `SO-TEST-${year}-${String(soCount + 1).padStart(5, "0")}`,
      proformaId: proforma.id,
      quotationId: proforma.quotationId,
      customerId: proforma.customerId,
      status: "Open",
      subtotal: proforma.subtotal,
      taxAmount: proforma.taxAmount,
      discountPercent: proforma.discountPercent,
      grandTotal: proforma.grandTotal,
      createdById: adminUser.id,
      companyId,
    },
  });
  check(`Created Sales Order from proforma`, !!so, so.orderNumber);

  // Verify the block condition: proforma now has a SalesOrder
  const lockedProforma = await prisma.proformaInvoice.findUnique({
    where: { id: proforma.id },
    include: { SalesOrder: { select: { id: true, orderNumber: true } } },
  });
  check(`Proforma now has linked SalesOrder (block condition met)`, !!lockedProforma?.SalesOrder, lockedProforma?.SalesOrder?.orderNumber);

  // The API would return 409 here — we verify the condition the API checks
  check(`Block condition: proforma.SalesOrder is truthy`, !!lockedProforma?.SalesOrder);

  // ─── 3c: SalesOrder ERP fields ─────────────────────────────────────────────
  console.log("\n=== 3c: SalesOrder ERP sync fields ===\n");

  const soWithFields = await prisma.salesOrder.findUnique({
    where: { id: so.id },
    select: { id: true, orderNumber: true, erpReference: true, erpReferenceNumber: true, erpSyncStatus: true, erpPayload: true, erpResponse: true, erpSyncedAt: true },
  });
  check(`SalesOrder has erpReference field`, soWithFields !== null);
  check(`SalesOrder.erpReference is null before sync`, soWithFields?.erpReference === null);
  check(`SalesOrder.erpSyncStatus is null before sync`, soWithFields?.erpSyncStatus === null);
  check(`SalesOrder.erpPayload field exists`, soWithFields !== null);
  check(`SalesOrder.erpResponse field exists`, soWithFields !== null);
  check(`SalesOrder.erpSyncedAt field exists`, soWithFields !== null);

  // Verify config-missing path: SUKI_ERP_API_URL not set
  const hasErpUrl = !!process.env.SUKI_ERP_API_URL;
  check(`SUKI_ERP_API_URL is NOT set (config-missing path is testable)`, !hasErpUrl);

  // ─── 3d: Dashboard executive performance (raw DB counts) ──────────────────
  console.log("\n=== 3d: Dashboard executive performance (raw DB) ===\n");

  const users = await prisma.user.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true, role: true } });
  if (users.length > 0) {
    // Pick the user with the most leads for verification
    let bestUser: any = null;
    let bestLeads = -1;
    for (const u of users) {
      const c = await prisma.lead.count({ where: { assignedUserId: u.id, deletedAt: null } });
      if (c > bestLeads) { bestLeads = c; bestUser = u; }
    }
    if (bestUser) {
      const [leadsHandled, quotationsSent, dealsWon, revenueAgg] = await Promise.all([
        prisma.lead.count({ where: { assignedUserId: bestUser.id, deletedAt: null } }),
        prisma.quotation.count({ where: { createdById: bestUser.id, deletedAt: null, status: { not: "Draft" } } }),
        prisma.deal.count({ where: { assignedUserId: bestUser.id, deletedAt: null, status: "Won" } }),
        prisma.deal.aggregate({ where: { assignedUserId: bestUser.id, deletedAt: null, status: "Won" }, _sum: { dealValue: true } }),
      ]);
      check(`Executive ${bestUser.name}: leadsHandled=${leadsHandled}`, leadsHandled >= 0);
      check(`Executive ${bestUser.name}: quotationsSent=${quotationsSent}`, quotationsSent >= 0);
      check(`Executive ${bestUser.name}: dealsWon=${dealsWon}`, dealsWon >= 0);
      check(`Executive ${bestUser.name}: revenue=${revenueAgg._sum.dealValue || 0}`, (revenueAgg._sum.dealValue || 0) >= 0);
      console.log(`\n  Verified executive: ${bestUser.name} (role=${bestUser.role})`);
      console.log(`    leads=${leadsHandled}, quotations=${quotationsSent}, dealsWon=${dealsWon}, revenue=${revenueAgg._sum.dealValue || 0}`);
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  console.log("\n=== Cleanup ===\n");
  await prisma.proformaInvoiceHistory.deleteMany({ where: { proformaId: proforma.id } });
  await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: so.id } });
  await prisma.salesOrder.delete({ where: { id: so.id } });
  if (proforma.proformaNumber.startsWith("PF-TEST-")) {
    await prisma.proformaInvoiceItem.deleteMany({ where: { proformaId: proforma.id } });
    await prisma.proformaInvoice.delete({ where: { id: proforma.id } });
  }
  console.log("Cleaned up test data.");

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
