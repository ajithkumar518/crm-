/**
 * GST Consistency Audit Script
 *
 * Scans all Proforma Invoices and Quotations to flag records where the
 * stored tax type (CGST+SGST vs IGST) appears inconsistent with the
 * Supplier State vs Place of Supply comparison.
 *
 * Does NOT modify any records — produces a report only.
 *
 * Usage: npx tsx scripts/audit-gst-consistency.ts
 */
import { prisma } from "../lib/prisma";
import { resolveTaxTreatment, getStateCodeFromGstin, getStateCodeFromName } from "../lib/gstState";

async function main() {
  const companyGstinConfig = await prisma.systemConfig.findUnique({ where: { key: "company_gstin" } });
  const companyGstin = companyGstinConfig?.value || null;
  const supplierStateCode = getStateCodeFromGstin(companyGstin);
  const supplierStateName = supplierStateCode
    ? { "33": "Tamil Nadu", "32": "Kerala", "29": "Karnataka" }[supplierStateCode] || `Code ${supplierStateCode}`
    : "UNKNOWN";

  console.log("=".repeat(80));
  console.log("GST CONSISTENCY AUDIT REPORT");
  console.log("=".repeat(80));
  console.log(`Company GSTIN: ${companyGstin || "(not configured)"}`);
  console.log(`Supplier State: ${supplierStateName} (code: ${supplierStateCode || "—"})`);
  console.log();

  if (!supplierStateCode) {
    console.log("ERROR: Company GSTIN not configured. Cannot audit. Run scripts/set-company-configs.ts first.");
    return;
  }

  // ─── Audit Proforma Invoices ──────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("PROFORMA INVOICES");
  console.log("─".repeat(80));

  const proformas = await prisma.proformaInvoice.findMany({
    include: {
      customer: { select: { name: true, state: true, gstNumber: true } },
      items: { select: { taxPercent: true, hsn: true } },
    },
    orderBy: { proformaNumber: "asc" },
  });

  let proformaIssues = 0;
  let proformaChecked = 0;

  for (const p of proformas) {
    proformaChecked++;
    const placeOfSupply = p.placeOfSupply || p.shipState || p.billState || p.customer?.state || null;
    const result = resolveTaxTreatment(
      companyGstin,
      p.placeOfSupply,
      p.shipGstNumber,
      p.shipState,
      p.billGstNumber || p.customer?.gstNumber,
      p.billState || p.customer?.state,
    );

    const expectedType = result.treatment === "intra_state" ? "CGST+SGST" : result.treatment === "inter_state" ? "IGST" : "UNKNOWN";
    const posState = result.placeOfSupplyStateCode
      ? { "33": "Tamil Nadu", "32": "Kerala", "29": "Karnataka", "37": "Andhra Pradesh" }[result.placeOfSupplyStateCode] || `Code ${result.placeOfSupplyStateCode}`
      : "UNKNOWN";

    // Check if placeOfSupply field is set but contradicts shipState
    const posFieldSet = !!p.placeOfSupply;
    const posFieldStateCode = getStateCodeFromName(p.placeOfSupply);
    const shipStateCode = getStateCodeFromName(p.shipState);
    const posContradictsShip = posFieldSet && shipStateCode && posFieldStateCode && posFieldStateCode !== shipStateCode;

    // Check if placeOfSupply defaults to supplier state (which would make it intra-state, possibly wrong)
    const posDefaultsToSupplier = !p.placeOfSupply && !p.shipState && !p.billState && !p.customer?.state;

    const hasIssue = result.treatment === "unknown" || posContradictsShip || posDefaultsToSupplier;

    if (hasIssue || posContradictsShip) {
      proformaIssues++;
      console.log(`\n  ⚠ ${p.proformaNumber}`);
      console.log(`    Customer: ${p.customer?.name || "—"}`);
      console.log(`    Place of Supply field: "${p.placeOfSupply || "(not set)"}"`);
      console.log(`    Ship State: "${p.shipState || "(not set)"}"`);
      console.log(`    Bill State: "${p.billState || "(not set)"}"`);
      console.log(`    Customer State: "${p.customer?.state || "(not set)"}"`);
      console.log(`    Resolved PoS State: ${posState}`);
      console.log(`    Expected Tax Type: ${expectedType}`);
      if (result.warning) console.log(`    Warning: ${result.warning}`);
      if (posContradictsShip) console.log(`    ⚠ Place of Supply field contradicts Ship-To state!`);
      if (posDefaultsToSupplier) console.log(`    ⚠ No state info at all — Place of Supply defaults to supplier state (likely wrong)`);
    }
  }

  console.log(`\n  Proformas checked: ${proformaChecked}, issues found: ${proformaIssues}`);

  // ─── Audit Quotations ─────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(80));
  console.log("QUOTATIONS");
  console.log("─".repeat(80));

  const quotations = await prisma.quotation.findMany({
    where: { deletedAt: null, status: { in: ["Sent", "Approved", "Negotiating"] } },
    include: {
      customer: { select: { name: true, state: true, gstNumber: true } },
      items: { select: { taxPercent: true } },
    },
    orderBy: { quotationCode: "asc" },
  });

  let quotationIssues = 0;
  let quotationChecked = 0;

  for (const q of quotations) {
    quotationChecked++;
    const result = resolveTaxTreatment(
      companyGstin,
      null, // Quotation doesn't have placeOfSupply field yet
      null,
      q.customer?.state, // ship state = customer state (best available)
      q.customer?.gstNumber,
      q.customer?.state,
    );

    const expectedType = result.treatment === "intra_state" ? "CGST+SGST" : result.treatment === "inter_state" ? "IGST" : "UNKNOWN";
    const posState = result.placeOfSupplyStateCode
      ? { "33": "Tamil Nadu", "32": "Kerala", "29": "Karnataka", "37": "Andhra Pradesh" }[result.placeOfSupplyStateCode] || `Code ${result.placeOfSupplyStateCode}`
      : "UNKNOWN";

    if (result.treatment === "unknown") {
      quotationIssues++;
      console.log(`\n  ⚠ ${q.quotationCode} (R${q.revisionNumber})`);
      console.log(`    Customer: ${q.customer?.name || "—"}`);
      console.log(`    Customer State: "${q.customer?.state || "(not set)"}"`);
      console.log(`    Customer GSTIN: "${q.customer?.gstNumber || "(not set)"}"`);
      console.log(`    Expected Tax Type: ${expectedType}`);
      if (result.warning) console.log(`    Warning: ${result.warning}`);
    }
  }

  console.log(`\n  Quotations checked: ${quotationChecked}, issues found: ${quotationIssues}`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Proforma Invoices: ${proformaChecked} checked, ${proformaIssues} flagged`);
  console.log(`Quotations:        ${quotationChecked} checked, ${quotationIssues} flagged`);
  console.log();
  console.log("NOTE: Flagged records are NOT auto-corrected. Review each one and");
  console.log("update the Place of Supply / Ship-To state fields as needed.");
  console.log("=".repeat(80));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
