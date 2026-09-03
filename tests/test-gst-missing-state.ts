/**
 * Unit test: GST tax-type determination with missing/incomplete state data.
 *
 * PROVES:
 * 1. The OLD code silently defaulted "unknown" → CGST+SGST (the bug).
 * 2. The NEW code throws an error when treatment is "unknown" (the fix).
 * 3. resolveTaxTreatment returns "unknown" (not a silent default) when state data is missing.
 * 4. computeGstSplit throws on "unknown" treatment.
 * 5. PDF generators throw when state data is missing (blocking PDF generation).
 *
 * Usage: npx tsx tests/test-gst-missing-state.ts
 */
import { resolveTaxTreatment, computeGstSplit, TaxTreatment } from "../lib/gstState";
import { generateSukiProformaInvoicePdf } from "../lib/generateSukiProformaInvoicePdf";
import { generateSukiQuotationPdf } from "../lib/generateSukiQuotationPdf";

const COMPANY_GSTIN = "33ABACS6559E1ZD"; // Tamil Nadu

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

function checkThrows(label: string, fn: () => void, expectedMsgFragment?: string) {
  try {
    fn();
    console.log(`  ✗ ${label} — expected throw but did not throw`);
    fail++;
  } catch (err: any) {
    if (expectedMsgFragment && !err.message.includes(expectedMsgFragment)) {
      console.log(`  ✗ ${label} — threw but wrong message: "${err.message}" (expected "${expectedMsgFragment}")`);
      fail++;
    } else {
      console.log(`  ✓ ${label}`);
      pass++;
    }
  }
}

function main() {
  console.log("=".repeat(80));
  console.log("GST MISSING STATE DATA — BLOCKING TEST");
  console.log("=".repeat(80));
  console.log(`Supplier: Shahnaz Bright Steel — Tamil Nadu (33) — GSTIN: ${COMPANY_GSTIN}`);
  console.log();

  // ─── Part 1: resolveTaxTreatment returns "unknown" for missing data ──────
  console.log("─".repeat(80));
  console.log("Part 1: resolveTaxTreatment returns 'unknown' for missing state data");
  console.log("─".repeat(80));

  // All null → unknown
  const r1 = resolveTaxTreatment(COMPANY_GSTIN, null, null, null, null, null);
  check("All null → treatment = unknown", r1.treatment === "unknown", `got ${r1.treatment}`);
  check("All null → has warning", !!r1.warning);
  check("All null → warning mentions Place of Supply", !!(r1.warning?.includes("Place of Supply")));

  // Empty strings → unknown
  const r2 = resolveTaxTreatment(COMPANY_GSTIN, "", "", "", "", "");
  check("All empty strings → treatment = unknown", r2.treatment === "unknown", `got ${r2.treatment}`);

  // Undefined → unknown
  const r3 = resolveTaxTreatment(COMPANY_GSTIN, undefined, undefined, undefined, undefined, undefined);
  check("All undefined → treatment = unknown", r3.treatment === "unknown", `got ${r3.treatment}`);

  // Supplier GSTIN missing → unknown
  const r4 = resolveTaxTreatment(null, "Tamil Nadu", null, null, null, null);
  check("No supplier GSTIN → treatment = unknown", r4.treatment === "unknown");
  check("No supplier GSTIN → warning mentions company_gstin", !!(r4.warning?.includes("company_gstin")));

  // Invalid/unparseable GSTIN → unknown
  const r5 = resolveTaxTreatment(COMPANY_GSTIN, null, "INVALID", null, null, null);
  check("Invalid ship GSTIN → treatment = unknown", r5.treatment === "unknown", `got ${r5.treatment}`);

  console.log();

  // ─── Part 2: computeGstSplit THROWS on "unknown" treatment ───────────────
  console.log("─".repeat(80));
  console.log("Part 2: computeGstSplit THROWS on 'unknown' treatment (the fix)");
  console.log("─".repeat(80));

  checkThrows(
    "computeGstSplit with 'unknown' throws error",
    () => computeGstSplit(100000, 18, "unknown"),
    "unknown"
  );

  checkThrows(
    "computeGstSplit error mentions tax treatment",
    () => computeGstSplit(50000, 18, "unknown"),
    "tax treatment"
  );

  // Verify it does NOT throw for valid treatments
  try {
    const intra = computeGstSplit(100000, 18, "intra_state");
    check("computeGstSplit with 'intra_state' does NOT throw", intra.cgst === 9000);
  } catch {
    check("computeGstSplit with 'intra_state' does NOT throw", false, "threw unexpectedly");
  }

  try {
    const inter = computeGstSplit(100000, 18, "inter_state");
    check("computeGstSplit with 'inter_state' does NOT throw", inter.igst === 18000);
  } catch {
    check("computeGstSplit with 'inter_state' does NOT throw", false, "threw unexpectedly");
  }

  console.log();

  // ─── Part 3: PDF generators throw when state data is missing ─────────────
  console.log("─".repeat(80));
  console.log("Part 3: PDF generators BLOCK when state data is missing");
  console.log("─".repeat(80));

  const baseProformaData = {
    proformaNumber: "TEST-MISSING-STATE",
    proformaDate: new Date("2026-08-22"),
    validityDate: new Date("2026-09-22"),
    customer: {
      name: "Missing State Customer",
      billingAddress: "Test Address",
      shippingAddress: "Test Address",
      state: null,  // ← no state
      gstNumber: null,  // ← no GSTIN
      phone: "9999999999",
    },
    contact: null,
    company: {
      name: "Shahnaz Bright Steel Industries Pvt Ltd",
      gstin: COMPANY_GSTIN,
    },
    items: [{
      description: "Test Item",
      hsn: "7214",
      quantity: 100,
      unit: "Kgs",
      numberOfPieces: 10,
      unitPrice: 50,
      discountPercent: 0,
      taxPercent: 18,
      taxable: 5000,
      cuttingCharge: 0,
    }],
    charges: { transportCharge: 0, otherCharges: 0, weighingLoadingCharge: 0, deliveryCharge: 0, testingCharge: 0 },
    bank: { name: "Test", ifsc: "TEST", accountNo: "123", branch: "Test" },
    subtotal: 5000,
    taxAmount: 900,
    grandTotal: 5900,
    roundedOff: 0,
    // ALL state fields null/missing
    placeOfSupply: null,
    state: null,
    stateCode: null,
    billState: null,
    billStateCode: null,
    billGstNumber: null,
    shipState: null,
    shipStateCode: null,
    shipGstNumber: null,
  };

  checkThrows(
    "Proforma PDF generation throws when all state data is missing",
    () => generateSukiProformaInvoicePdf(baseProformaData as any),
    "could not be determined"
  );

  const baseQuotationData = {
    quotationCode: "QT-MISSING-STATE",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-22"),
    customer: {
      name: "Missing State Customer",
      state: null,
      gstNumber: null,
    },
    contact: null,
    company: { name: "Shahnaz Bright Steel Industries Pvt Ltd" },
    items: [{
      description: "Test Item",
      quantity: 100,
      unitPrice: 50,
      taxPercent: 18,
      unit: "Kgs",
    }],
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
    placeOfSupply: null,
    shipState: null,
    shipGstNumber: null,
  };

  checkThrows(
    "Quotation PDF generation throws when all state data is missing",
    () => generateSukiQuotationPdf(baseQuotationData as any),
    "could not be determined"
  );

  console.log();

  // ─── Part 4: PDF generators still work when state IS provided ────────────
  console.log("─".repeat(80));
  console.log("Part 4: PDF generators still work when state IS provided");
  console.log("─".repeat(80));

  try {
    const validProforma = generateSukiProformaInvoicePdf({
      ...baseProformaData,
      placeOfSupply: "Tamil Nadu",
      shipState: "Tamil Nadu",
      shipGstNumber: "33AABCT5678E1Z5",
      billState: "Tamil Nadu",
      billGstNumber: "33AABCT5678E1Z5",
    });
    check("Proforma PDF generates successfully with TN state data", !!validProforma);
  } catch (err: any) {
    check("Proforma PDF generates successfully with TN state data", false, err.message);
  }

  try {
    const validQuotation = generateSukiQuotationPdf({
      ...baseQuotationData,
      customer: { name: "TN Customer", state: "Tamil Nadu", gstNumber: "33AABCT5678E1Z5" },
      placeOfSupply: "Tamil Nadu",
      shipState: "Tamil Nadu",
      shipGstNumber: "33AABCT5678E1Z5",
    });
    check("Quotation PDF generates successfully with TN state data", !!validQuotation);
  } catch (err: any) {
    check("Quotation PDF generates successfully with TN state data", false, err.message);
  }

  console.log();

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("=".repeat(80));
  console.log(`RESULTS: ${pass} passed, ${fail} failed`);
  console.log("=".repeat(80));
  if (fail > 0) process.exit(1);
}

main();
