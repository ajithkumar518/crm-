/**
 * Comprehensive audit: check ALL Quotations and Proformas for partial/missing
 * state data that could cause silent tax-type defaulting.
 */
import { prisma } from "../lib/prisma";
import { resolveTaxTreatment, getStateCodeFromGstin, getStateCodeFromName } from "../lib/gstState";

async function main() {
  const gstinConfig = await prisma.systemConfig.findUnique({ where: { key: "company_gstin" } });
  const companyGstin = gstinConfig?.value || null;
  const supplierCode = getStateCodeFromGstin(companyGstin);

  console.log("=".repeat(100));
  console.log("COMPREHENSIVE GST STATE DATA AUDIT");
  console.log("=".repeat(100));
  console.log(`Company GSTIN: ${companyGstin} → Supplier State Code: ${supplierCode}`);
  console.log();

  // ─── Proforma Invoices ──────────────────────────────────────────────────
  console.log("─".repeat(100));
  console.log("PROFORMA INVOICES");
  console.log("─".repeat(100));

  const proformas = await prisma.proformaInvoice.findMany({
    include: {
      customer: { select: { name: true, state: true, gstNumber: true, customerCode: true } },
      items: { select: { description: true, taxPercent: true, hsn: true } },
    },
    orderBy: { proformaNumber: "asc" },
  });

  let pFlagged = 0;
  for (const p of proformas) {
    const result = resolveTaxTreatment(
      companyGstin,
      p.placeOfSupply,
      p.shipGstNumber,
      p.shipState,
      p.billGstNumber || p.customer?.gstNumber,
      p.billState || p.customer?.state,
    );

    const hasAnyState = !!(p.placeOfSupply || p.shipState || p.billState || p.customer?.state || p.shipGstNumber || p.billGstNumber || p.customer?.gstNumber);
    const isUnknown = result.treatment === "unknown";
    const hasPartialPos = !!p.placeOfSupply && !getStateCodeFromName(p.placeOfSupply);
    const hasInvalidShipGstin = !!p.shipGstNumber && !getStateCodeFromGstin(p.shipGstNumber);
    const hasInvalidBillGstin = !!p.billGstNumber && !getStateCodeFromGstin(p.billGstNumber);
    const hasInvalidCustGstin = !!p.customer?.gstNumber && !getStateCodeFromGstin(p.customer?.gstNumber);

    const flagged = isUnknown || hasPartialPos || hasInvalidShipGstin || hasInvalidBillGstin || hasInvalidCustGstin;

    if (flagged) {
      pFlagged++;
      console.log();
      console.log(`  ⚠ ${p.proformaNumber} (Status: ${p.status})`);
      console.log(`    Customer: ${p.customer?.name} (${p.customer?.customerCode})`);
      console.log(`    Treatment: ${result.treatment}`);
      console.log(`    Has ANY state data: ${hasAnyState}`);
      console.log(`    placeOfSupply: ${JSON.stringify(p.placeOfSupply)}`);
      console.log(`    shipState: ${JSON.stringify(p.shipState)} / shipGstNumber: ${JSON.stringify(p.shipGstNumber)}`);
      console.log(`    billState: ${JSON.stringify(p.billState)} / billGstNumber: ${JSON.stringify(p.billGstNumber)}`);
      console.log(`    customer.state: ${JSON.stringify(p.customer?.state)} / customer.gst: ${JSON.stringify(p.customer?.gstNumber)}`);
      if (isUnknown) console.log(`    ⚠ UNKNOWN treatment — would silently default to CGST+SGST`);
      if (hasPartialPos) console.log(`    ⚠ placeOfSupply set but unparseable: "${p.placeOfSupply}"`);
      if (hasInvalidShipGstin) console.log(`    ⚠ shipGstNumber invalid/unparseable: "${p.shipGstNumber}"`);
      if (hasInvalidBillGstin) console.log(`    ⚠ billGstNumber invalid/unparseable: "${p.billGstNumber}"`);
      if (hasInvalidCustGstin) console.log(`    ⚠ customer.gstNumber invalid/unparseable: "${p.customer?.gstNumber}"`);
      if (result.warning) console.log(`    Warning: ${result.warning}`);
    }
  }
  console.log(`\n  Proformas: ${proformas.length} total, ${pFlagged} flagged`);

  // ─── Quotations ─────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(100));
  console.log("QUOTATIONS (all statuses, not deleted)");
  console.log("─".repeat(100));

  const quotations = await prisma.quotation.findMany({
    where: { deletedAt: null },
    include: {
      customer: { select: { name: true, state: true, gstNumber: true, customerCode: true } },
      items: { select: { description: true, taxPercent: true } },
    },
    orderBy: { quotationCode: "asc" },
  });

  let qFlagged = 0;
  for (const q of quotations) {
    // Quotations don't have placeOfSupply/shipState fields yet — use customer state
    const result = resolveTaxTreatment(
      companyGstin,
      null,
      null,
      q.customer?.state,
      q.customer?.gstNumber,
      q.customer?.state,
    );

    const isUnknown = result.treatment === "unknown";
    const hasInvalidCustGstin = !!q.customer?.gstNumber && !getStateCodeFromGstin(q.customer?.gstNumber);
    const hasStateButNoCode = !!q.customer?.state && !getStateCodeFromName(q.customer?.state);

    const flagged = isUnknown || hasInvalidCustGstin || hasStateButNoCode;

    if (flagged) {
      qFlagged++;
      console.log();
      console.log(`  ⚠ ${q.quotationCode} R${q.revisionNumber} (Status: ${q.status})`);
      console.log(`    Customer: ${q.customer?.name} (${q.customer?.customerCode})`);
      console.log(`    Treatment: ${result.treatment}`);
      console.log(`    customer.state: ${JSON.stringify(q.customer?.state)}`);
      console.log(`    customer.gst: ${JSON.stringify(q.customer?.gstNumber)}`);
      if (isUnknown) console.log(`    ⚠ UNKNOWN treatment — would silently default to CGST+SGST`);
      if (hasInvalidCustGstin) console.log(`    ⚠ customer.gstNumber invalid: "${q.customer?.gstNumber}"`);
      if (hasStateButNoCode) console.log(`    ⚠ customer.state set but unparseable: "${q.customer?.state}"`);
      if (result.warning) console.log(`    Warning: ${result.warning}`);
    }
  }
  console.log(`\n  Quotations: ${quotations.length} total, ${qFlagged} flagged`);

  console.log("\n" + "=".repeat(100));
  console.log(`SUMMARY: ${pFlagged} Proformas flagged, ${qFlagged} Quotations flagged`);
  console.log("=".repeat(100));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
