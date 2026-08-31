import { prisma } from "../lib/prisma";

async function main() {
  const proformas = await prisma.proformaInvoice.findMany({
    include: {
      customer: { select: { name: true, state: true, gstNumber: true, customerCode: true } },
      items: { select: { id: true, description: true, taxPercent: true, hsn: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { proformaNumber: "asc" },
  });

  console.log("=".repeat(100));
  console.log("PROFORMA INVOICE AUDIT — DETAILED BREAKDOWN");
  console.log("=".repeat(100));
  console.log(`Total Proformas in DB: ${proformas.length}`);
  console.log();

  for (const p of proformas) {
    console.log("─".repeat(100));
    console.log(`Proforma #: ${p.proformaNumber}`);
    console.log(`  ID:           ${p.id}`);
    console.log(`  Status:       ${p.status}`);
    console.log(`  Date:         ${p.proformaDate.toISOString().split("T")[0]}`);
    console.log(`  Customer:     ${p.customer?.name || "—"}`);
    console.log(`  Customer Code: ${p.customer?.customerCode || "—"}`);
    console.log(`  Created By:   ${p.createdBy?.name || p.createdBy?.email || "—"}`);
    console.log(`  Source Quotation #: ${p.sourceQuotationNumber || "—"}`);
    console.log();
    console.log("  STATE FIELDS:");
    console.log(`    placeOfSupply:  ${JSON.stringify(p.placeOfSupply)}`);
    console.log(`    shipState:      ${JSON.stringify(p.shipState)}`);
    console.log(`    shipStateCode:  ${JSON.stringify(p.shipStateCode)}`);
    console.log(`    shipGstNumber:  ${JSON.stringify(p.shipGstNumber)}`);
    console.log(`    billState:      ${JSON.stringify(p.billState)}`);
    console.log(`    billStateCode:  ${JSON.stringify(p.billStateCode)}`);
    console.log(`    billGstNumber:  ${JSON.stringify(p.billGstNumber)}`);
    console.log(`    customer.state: ${JSON.stringify(p.customer?.state)}`);
    console.log(`    customer.gst:   ${JSON.stringify(p.customer?.gstNumber)}`);
    console.log();
    console.log("  ITEMS:");
    for (const it of p.items) {
      console.log(`    - ${it.description} | HSN: ${it.hsn || "—"} | tax%: ${it.taxPercent || "—"}`);
    }
    console.log();

    // Determine what's missing
    const hasAnyState = !!(p.placeOfSupply || p.shipState || p.billState || p.customer?.state);
    const hasShipState = !!p.shipState;
    const hasPosField = !!p.placeOfSupply;
    const hasBillState = !!p.billState;
    const hasCustomerState = !!p.customer?.state;

    if (!hasAnyState) {
      console.log("  ⚠ FLAGGED: NO state info at all — ALL fields are null/empty");
      console.log("    Missing: placeOfSupply, shipState, billState, customer.state");
    } else {
      const missing: string[] = [];
      if (!hasPosField) missing.push("placeOfSupply");
      if (!hasShipState) missing.push("shipState");
      if (!hasBillState) missing.push("billState");
      if (!hasCustomerState) missing.push("customer.state");
      if (missing.length > 0) {
        console.log(`  ⚠ PARTIAL: Some state fields missing: ${missing.join(", ")}`);
      } else {
        console.log("  ✓ All state fields present");
      }
    }

    // Check if this looks like test/seed data
    const isTest = p.proformaNumber.includes("TEST") ||
                   p.customer?.name?.includes("test") ||
                   p.customer?.name?.includes("Test") ||
                   p.customer?.customerCode?.includes("TEST");
    console.log(`  Classification: ${isTest ? "TEST/SEED DATA" : "POTENTIALLY REAL"}`);
    console.log();
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
