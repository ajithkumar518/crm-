/**
 * End-to-end test for 3a (proforma item edit + history + Sales-Order block),
 * 3c (Sales Order ERP sync — config-missing path).
 *
 * Run: npx tsx scripts/test-phase3-e2e.ts
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

const API_BASE = "http://localhost:3000";

async function main() {
  let pass = 0;
  let fail = 0;
  const check = (label: string, condition: boolean, detail?: string) => {
    const status = condition ? "PASS" : "FAIL";
    if (condition) pass++; else fail++;
    console.log(`[${status}] ${label}${detail ? " — " + detail : ""}`);
  };

  // Login as admin
  const adminUser = await prisma.user.findFirst({ where: { role: "Admin", isActive: true }, select: { id: true, email: true, companyId: true } });
  if (!adminUser) { console.log("No admin user found"); process.exit(1); }
  console.log(`Using admin: ${adminUser.email}`);

  // Get a session cookie by hitting login API
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminUser.email, password: "admin123" }),
  });
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) {
    console.log("Login failed — cannot run E2E. Start dev server first.");
    process.exit(1);
  }
  console.log(`Logged in, cookie: ${cookie.slice(0, 30)}...`);
  const headers = { "Content-Type": "application/json", Cookie: cookie };

  // ─── 3a: Find or create a proforma, then edit an item ─────────────────────
  console.log("\n=== 3a: Proforma item edit + history ===\n");

  let proforma = await prisma.proformaInvoice.findFirst({
    where: { SalesOrder: null, companyId: adminUser.companyId },
    include: { items: true, SalesOrder: { select: { id: true } } },
  });

  if (!proforma) {
    console.log("[INFO] No editable proforma — creating a minimal one");
    const customer = await prisma.customer.findFirst({ where: { companyId: adminUser.companyId } });
    const quotation = await prisma.quotation.findFirst({ where: { companyId: adminUser.companyId } });
    const year = new Date().getFullYear();
    const count = await prisma.proformaInvoice.count({ where: { proformaNumber: { startsWith: `PF-${year}-` } } });
    proforma = await prisma.proformaInvoice.create({
      data: {
        proformaNumber: `PF-${year}-${String(count + 1).padStart(5, "0")}`,
        quotationId: quotation?.id || null,
        customerId: customer!.id,
        status: "Draft",
        subtotal: 1000,
        taxAmount: 180,
        grandTotal: 1180,
        createdById: adminUser.id,
        companyId: adminUser.companyId,
        items: {
          create: [{ description: "Test item", quantity: 10, unitPrice: 100, lineTotal: 1000, taxPercent: 18 }],
        },
      },
      include: { items: true, SalesOrder: { select: { id: true } } },
    });
  }

  const itemId = proforma.items[0].id;
  const originalQty = proforma.items[0].quantity;
  const newQty = originalQty + 5;

  const patchRes = await fetch(`${API_BASE}/api/proforma-invoices/${proforma.id}/items`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ items: [{ id: itemId, quantity: newQty }] }),
  });
  const patchData = await patchRes.json();
  check(`PATCH /items returns 200`, patchRes.status === 200, `status=${patchRes.status}`);
  check(`PATCH /items success=true`, patchData.success === true, patchData.message);

  if (patchData.success) {
    const refreshed = patchData.data;
    const updatedItem = refreshed.items.find((i: any) => i.id === itemId);
    check(`Item quantity updated to ${newQty}`, updatedItem?.quantity === newQty, `got ${updatedItem?.quantity}`);
    check(`Subtotal recalculated`, refreshed.subtotal !== proforma.subtotal, `${proforma.subtotal} → ${refreshed.subtotal}`);
    check(`Grand total recalculated`, refreshed.grandTotal !== proforma.grandTotal, `${proforma.grandTotal} → ${refreshed.grandTotal}`);
    check(`History entry created`, refreshed.histories && refreshed.histories.length > 0, `${refreshed.histories?.length} history row(s)`);
    if (refreshed.histories?.length > 0) {
      const h = refreshed.histories[0];
      check(`History row records field=quantity`, h.fieldName === "quantity", `${h.fieldName}: ${h.previousValue} → ${h.newValue}`);
      check(`History row has changedBy user`, !!h.changedBy, h.changedBy?.name);
    }
  }

  // ─── 3a: Test Sales-Order block path ──────────────────────────────────────
  console.log("\n=== 3a: Sales-Order block path ===\n");

  // Create a Sales Order from this proforma to test the block
  const soCreateRes = await fetch(`${API_BASE}/api/proforma-invoices/${proforma.id}/sales-order`, {
    method: "POST",
    headers,
  });
  const soCreateData = await soCreateRes.json();
  check(`Create Sales Order from proforma`, soCreateData.success === true, soCreateData.message || soCreateData.data?.orderNumber);

  if (soCreateData.success) {
    // Now try to edit items — should be blocked
    const blockedRes = await fetch(`${API_BASE}/api/proforma-invoices/${proforma.id}/items`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ items: [{ id: itemId, quantity: 999 }] }),
    });
    const blockedData = await blockedRes.json();
    check(`Edit blocked with 409 when Sales Order exists`, blockedRes.status === 409, `status=${blockedRes.status}`);
    check(`Block message is clear`, blockedData.success === false && /Sales Order/i.test(blockedData.message || ""), blockedData.message);
  }

  // ─── 3c: Sales Order ERP sync — config-missing path ───────────────────────
  console.log("\n=== 3c: Sales Order ERP sync (config-missing path) ===\n");

  const so = await prisma.salesOrder.findFirst({ where: { companyId: adminUser.companyId } });
  if (so) {
    const syncRes = await fetch(`${API_BASE}/api/sales-orders/${so.id}/sync-erp`, { method: "POST", headers });
    const syncData = await syncRes.json();
    check(`Sync without ERP config returns 500`, syncRes.status === 500, `status=${syncRes.status}`);
    check(`Sync error mentions SUKI_ERP_API_URL`, /SUKI_ERP_API_URL/i.test(syncData.message || ""), syncData.message);
  } else {
    console.log("[INFO] No Sales Order to test sync against");
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
