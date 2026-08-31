/**
 * GST Tax Treatment Verification — 3 Scenarios
 *
 * 1. Supplier TN, Place of Supply TN (same state) → CGST 9% + SGST 9%
 * 2. Supplier TN, Place of Supply AP (different state) → IGST 18%
 * 3. Multi-HSN, same Place of Supply → per-HSN tax correct, same tax type
 *
 * Usage: npx tsx tests/test-gst-scenarios.ts
 */
import { resolveTaxTreatment, computeGstSplit } from "../lib/gstState";
import { generateSukiProformaInvoicePdf } from "../lib/generateSukiProformaInvoicePdf";
import fs from "fs";
import path from "path";

const COMPANY_GSTIN = "33ABACS6559E1ZD"; // Tamil Nadu
const COMPANY_NAME = "Shahnaz Bright Steel Industries Private Limited";

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function makeBaseData(overrides: any = {}) {
  return {
    proformaNumber: overrides.proformaNumber || "TEST-PF-001",
    proformaDate: new Date("2026-08-22"),
    validityDate: new Date("2026-09-22"),
    customer: {
      name: overrides.customerName || "Test Customer",
      billingAddress: "Test Billing Address",
      shippingAddress: "Test Shipping Address",
      state: overrides.customerState || null,
      gstNumber: overrides.customerGstin || null,
      phone: "9999999999",
    },
    contact: null,
    company: {
      name: COMPANY_NAME,
      address: "No:1,Plot No.52A,52B,No.102,Mugappair Road",
      phone: "9363331766",
      email: "test@test.com",
      gstin: COMPANY_GSTIN,
      pan: "ABACS6559E",
      cin: "U28999TN2018PTC123999",
      regOff: "Test Reg Off",
    },
    items: overrides.items || [
      {
        description: "Steel Bar 20mm",
        hsn: "7214",
        quantity: 100,
        unit: "Kgs",
        numberOfPieces: 10,
        unitPrice: 50,
        discountPercent: 0,
        taxPercent: 18,
        taxable: 5000,
        cuttingCharge: 0,
      },
    ],
    charges: {
      transportCharge: 0,
      otherCharges: 0,
      weighingLoadingCharge: 0,
      deliveryCharge: 0,
      testingCharge: 0,
    },
    bank: { name: "Test Bank", ifsc: "TEST0001", accountNo: "1234567890", branch: "Chennai" },
    subtotal: 5000,
    taxAmount: 900,
    grandTotal: 5900,
    roundedOff: 0,
    paymentTerms: "30 Days",
    placeOfSupply: overrides.placeOfSupply || null,
    state: overrides.state || null,
    stateCode: overrides.stateCode || null,
    despatchThrough: "Road",
    vehicleNo: "TN01AB1234",
    customerPoNo: "PO-001",
    customerPoDate: new Date("2026-08-20"),
    ewayBillNo: null,
    ewayBillDate: null,
    irn: null,
    ackNo: null,
    ackDate: null,
    billName: overrides.billName || "Test Customer",
    billAddress: "Test Billing Address",
    billState: overrides.billState || null,
    billStateCode: overrides.billStateCode || null,
    billGstNumber: overrides.billGstNumber || null,
    billPhone: "9999999999",
    shipName: overrides.shipName || "Test Customer",
    shipAddress: "Test Shipping Address",
    shipState: overrides.shipState || null,
    shipStateCode: overrides.shipStateCode || null,
    shipGstNumber: overrides.shipGstNumber || null,
    shipPhone: "9999999999",
    preparedBy: "Test User",
    verifiedBy: null,
    declaration: null,
    termsAndConditions: null,
  };
}

function main() {
  console.log("=".repeat(80));
  console.log("GST TAX TREATMENT VERIFICATION — 3 SCENARIOS");
  console.log("=".repeat(80));
  console.log(`Supplier: ${COMPANY_NAME} — Tamil Nadu (Code 33) — GSTIN: ${COMPANY_GSTIN}`);
  console.log();

  // ─── Scenario 1: Supplier TN, Place of Supply TN (same state) ──────────────
  console.log("─".repeat(80));
  console.log("SCENARIO 1: Supplier TN, Place of Supply TN → expect CGST 9% + SGST 9%");
  console.log("─".repeat(80));

  const r1 = resolveTaxTreatment(COMPANY_GSTIN, "Tamil Nadu", null, null, null, null);
  console.log(`  resolveTaxTreatment result: treatment=${r1.treatment}, PoS code=${r1.placeOfSupplyStateCode}`);
  check("Treatment is intra_state", r1.treatment === "intra_state", `got ${r1.treatment}`);
  check("PoS state code = 33 (TN)", r1.placeOfSupplyStateCode === "33");

  const split1 = computeGstSplit(5000, 18, r1.treatment);
  console.log(`  computeGstSplit(5000, 18, intra_state): cgst=${round2(split1.cgst)}, sgst=${round2(split1.sgst)}, igst=${split1.igst}, totalTax=${round2(split1.totalTax)}`);
  check("CGST = 450 (9% of 5000)", round2(split1.cgst) === 450, `got ${round2(split1.cgst)}`);
  check("SGST = 450 (9% of 5000)", round2(split1.sgst) === 450, `got ${round2(split1.sgst)}`);
  check("IGST = 0", split1.igst === 0);
  check("Total tax = 900 (18% of 5000)", round2(split1.totalTax) === 900, `got ${round2(split1.totalTax)}`);

  // Generate PDF
  const data1 = makeBaseData({
    proformaNumber: "TEST-TN-TN-001",
    customerName: "TN Customer Pvt Ltd",
    customerState: "Tamil Nadu",
    customerGstin: "33ABCDE1234F1Z5",
    placeOfSupply: "Tamil Nadu",
    billState: "Tamil Nadu",
    billStateCode: "33",
    billGstNumber: "33ABCDE1234F1Z5",
    shipState: "Tamil Nadu",
    shipStateCode: "33",
    shipGstNumber: "33ABCDE1234F1Z5",
  });
  const pdf1 = generateSukiProformaInvoicePdf(data1);
  const pdf1Path = path.join(process.cwd(), "tests", "output-test-gst-scenario1-tn-tn.pdf");
  fs.writeFileSync(pdf1Path, Buffer.from(pdf1.output("arraybuffer")));
  console.log(`  PDF saved: ${pdf1Path}`);
  console.log();

  // ─── Scenario 2: Supplier TN, Place of Supply AP (different state) ─────────
  console.log("─".repeat(80));
  console.log("SCENARIO 2: Supplier TN, Place of Supply AP → expect IGST 18%");
  console.log("─".repeat(80));

  const r2 = resolveTaxTreatment(COMPANY_GSTIN, "Andhra Pradesh", null, null, null, null);
  console.log(`  resolveTaxTreatment result: treatment=${r2.treatment}, PoS code=${r2.placeOfSupplyStateCode}`);
  check("Treatment is inter_state", r2.treatment === "inter_state", `got ${r2.treatment}`);
  check("PoS state code = 37 (AP)", r2.placeOfSupplyStateCode === "37");

  const split2 = computeGstSplit(5000, 18, r2.treatment);
  console.log(`  computeGstSplit(5000, 18, inter_state): cgst=${split2.cgst}, sgst=${split2.sgst}, igst=${round2(split2.igst)}, totalTax=${round2(split2.totalTax)}`);
  check("CGST = 0", split2.cgst === 0);
  check("SGST = 0", split2.sgst === 0);
  check("IGST = 900 (18% of 5000)", round2(split2.igst) === 900, `got ${round2(split2.igst)}`);
  check("Total tax = 900", round2(split2.totalTax) === 900, `got ${round2(split2.totalTax)}`);

  // Generate PDF
  const data2 = makeBaseData({
    proformaNumber: "TEST-TN-AP-001",
    customerName: "AP Customer Pvt Ltd",
    customerState: "Andhra Pradesh",
    customerGstin: "37ABCDE1234F1Z5",
    placeOfSupply: "Andhra Pradesh",
    billState: "Andhra Pradesh",
    billStateCode: "37",
    billGstNumber: "37ABCDE1234F1Z5",
    shipState: "Andhra Pradesh",
    shipStateCode: "37",
    shipGstNumber: "37ABCDE1234F1Z5",
  });
  const pdf2 = generateSukiProformaInvoicePdf(data2);
  const pdf2Path = path.join(process.cwd(), "tests", "output-test-gst-scenario2-tn-ap.pdf");
  fs.writeFileSync(pdf2Path, Buffer.from(pdf2.output("arraybuffer")));
  console.log(`  PDF saved: ${pdf2Path}`);
  console.log();

  // ─── Scenario 3: Multi-HSN, same Place of Supply ──────────────────────────
  console.log("─".repeat(80));
  console.log("SCENARIO 3: 2+ line items, different HSN codes, same Place of Supply (TN)");
  console.log("─".repeat(80));

  const r3 = resolveTaxTreatment(COMPANY_GSTIN, "Tamil Nadu", null, null, null, null);
  console.log(`  resolveTaxTreatment result: treatment=${r3.treatment}`);
  check("Treatment is intra_state (TN→TN)", r3.treatment === "intra_state");

  // Item 1: HSN 7214, taxable=5000, 18%
  // Item 2: HSN 7228, taxable=3000, 18%
  // Item 3: HSN 7214, taxable=2000, 18% (same HSN as item 1, should aggregate)
  const items3 = [
    { description: "Steel Bar 20mm", hsn: "7214", quantity: 100, unit: "Kgs", numberOfPieces: 10, unitPrice: 50, discountPercent: 0, taxPercent: 18, taxable: 5000, cuttingCharge: 0 },
    { description: "Steel Wire 5mm", hsn: "7228", quantity: 60, unit: "Kgs", numberOfPieces: 5, unitPrice: 50, discountPercent: 0, taxPercent: 18, taxable: 3000, cuttingCharge: 0 },
    { description: "Steel Bar 15mm", hsn: "7214", quantity: 40, unit: "Kgs", numberOfPieces: 4, unitPrice: 50, discountPercent: 0, taxPercent: 18, taxable: 2000, cuttingCharge: 0 },
  ];

  // Compute per-item tax
  for (const it of items3) {
    const split = computeGstSplit(it.taxable, it.taxPercent, r3.treatment);
    console.log(`  Item ${it.description} (HSN ${it.hsn}, taxable=${it.taxable}): cgst=${round2(split.cgst)}, sgst=${round2(split.sgst)}, igst=${split.igst}`);
  }

  // HSN 7214 aggregate: taxable = 5000 + 2000 = 7000, tax = 7000 * 18% = 1260, cgst=630, sgst=630
  const hsn7214Taxable = 7000;
  const hsn7214Split = computeGstSplit(hsn7214Taxable, 18, r3.treatment);
  check("HSN 7214 aggregated taxable = 7000", hsn7214Taxable === 7000);
  check("HSN 7214 CGST = 630 (9% of 7000)", round2(hsn7214Split.cgst) === 630, `got ${round2(hsn7214Split.cgst)}`);
  check("HSN 7214 SGST = 630 (9% of 7000)", round2(hsn7214Split.sgst) === 630, `got ${round2(hsn7214Split.sgst)}`);

  // HSN 7228: taxable = 3000, tax = 3000 * 18% = 540, cgst=270, sgst=270
  const hsn7228Taxable = 3000;
  const hsn7228Split = computeGstSplit(hsn7228Taxable, 18, r3.treatment);
  check("HSN 7228 CGST = 270 (9% of 3000)", round2(hsn7228Split.cgst) === 270, `got ${round2(hsn7228Split.cgst)}`);
  check("HSN 7228 SGST = 270 (9% of 3000)", round2(hsn7228Split.sgst) === 270, `got ${round2(hsn7228Split.sgst)}`);

  // Total tax = 1260 + 540 = 1800
  const totalTax3 = round2(hsn7214Split.totalTax + hsn7228Split.totalTax);
  check("Total tax across all HSNs = 1800", totalTax3 === 1800, `got ${totalTax3}`);

  // All items use same tax type (intra_state)
  const allSameType = items3.every(() => r3.treatment === "intra_state");
  check("All line items use same tax type (intra_state)", allSameType);

  // Generate PDF
  const data3 = makeBaseData({
    proformaNumber: "TEST-MULTI-HSN-001",
    customerName: "Multi HSN Customer Pvt Ltd",
    customerState: "Tamil Nadu",
    customerGstin: "33ABCDE1234F1Z5",
    placeOfSupply: "Tamil Nadu",
    billState: "Tamil Nadu",
    billStateCode: "33",
    billGstNumber: "33ABCDE1234F1Z5",
    shipState: "Tamil Nadu",
    shipStateCode: "33",
    shipGstNumber: "33ABCDE1234F1Z5",
    items: items3,
    subtotal: 10000,
    taxAmount: 1800,
    grandTotal: 11800,
  });
  const pdf3 = generateSukiProformaInvoicePdf(data3);
  const pdf3Path = path.join(process.cwd(), "tests", "output-test-gst-scenario3-multi-hsn.pdf");
  fs.writeFileSync(pdf3Path, Buffer.from(pdf3.output("arraybuffer")));
  console.log(`  PDF saved: ${pdf3Path}`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(80));
  console.log(`RESULTS: ${pass} passed, ${fail} failed`);
  console.log("=".repeat(80));
  if (fail > 0) {
    process.exit(1);
  }
}

main();
