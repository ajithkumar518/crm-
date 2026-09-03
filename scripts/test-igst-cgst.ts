// @ts-nocheck
/**
 * GST Tax Treatment Test — IGST vs CGST+SGST
 *
 * Supplier: Shahnaz Bright Steel Industries Pvt Ltd
 *   GSTIN: 33ABACS6559E1ZD → Tamil Nadu (state code 33)
 *
 * Test cases:
 * 1. Same state:    Customer in Tamil Nadu → CGST + SGST (9% + 9%)
 * 2. Different state: Customer in Kerala    → IGST (18%)
 * 3. Unknown:       No state/GSTIN          → warning shown
 * 4. State mismatch: GSTIN≠state field      → GSTIN wins, warning shown
 * 5. Unit tests for resolveTaxTreatment + computeGstSplit
 * 6. Proforma PDF — same logic
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

import { generateSukiQuotationPdf } from "../lib/generateSukiQuotationPdf";
import { generateProformaPdf } from "../lib/generateProformaPdf";
import { resolveTaxTreatment, computeGstSplit, getStateCodeFromGstin } from "../lib/gstState";
import { PDFParse } from "pdf-parse";
import { writeFileSync } from "fs";

async function extractPdfText(pdfBytes: ArrayBuffer): Promise<string> {
  const uint8 = new Uint8Array(pdfBytes);
  const parser = new PDFParse(uint8);
  const result = await parser.getText();
  return (result as any).text || "";
}

async function main() {
  let pass = 0, fail = 0;
  const check = (label: string, condition: boolean, detail?: string) => {
    const status = condition ? "PASS" : "FAIL";
    if (condition) pass++; else fail++;
    console.log(`[${status}] ${label}${detail ? " — " + detail : ""}`);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Supplier: Shahnaz Bright Steel Industries Pvt Ltd — Tamil Nadu (33)
  // ──────────────────────────────────────────────────────────────────────────
  const COMPANY_GSTIN = "33ABACS6559E1ZD";
  const supplierStateCode = getStateCodeFromGstin(COMPANY_GSTIN);
  console.log(`\nSupplier: Shahnaz Bright Steel Industries Pvt Ltd`);
  console.log(`Supplier GSTIN: ${COMPANY_GSTIN} → state code: ${supplierStateCode} (Tamil Nadu)`);

  // ══════════════════════════════════════════════════════════════════════════
  // Test 1: SAME STATE — Customer in Tamil Nadu, Supplier in Tamil Nadu
  //   Expected: INTRA-STATE → CGST 9% + SGST 9% = ₹9,000 + ₹9,000
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n=== Test 1: SAME STATE (TN→TN) — expect CGST + SGST ===\n");

  const sameStateDoc = generateSukiQuotationPdf({
    quotationCode: "QT-TEST-SAME-STATE",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-22"),
    customer: {
      name: "Tamil Nadu Customer Pvt Ltd",
      customerCode: "TN-001",
      billingAddress: "Industrial Estate, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
      gstNumber: "33AABCT5678E1Z5",
      phone: "9876543210",
      email: "tn@test.com",
    },
    contact: { name: "TN Contact", phone: "9876543210" },
    company: { name: "Shahnaz Bright Steel Industries Pvt Ltd" },
    items: [{
      description: "SS304 Round Bar",
      productType: "Bright Bar",
      rmMake: "SAIL",
      numberOfPieces: 10,
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      cuttingCharge: 500,
      remarks: "Same-state (TN→TN) — should be CGST+SGST",
      unit: "kgs",
    }],
    transportCharge: 100,
    otherCharges: 50,
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
    placeOfSupply: "Tamil Nadu",
    shipState: "Tamil Nadu",
    shipGstNumber: "33AABCT5678E1Z5",
  });

  const sameStateText = await extractPdfText(sameStateDoc.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\QT-TEST-SAME-STATE-TN-TN.pdf", Buffer.from(sameStateDoc.output("arraybuffer")));

  console.log("\n--- Same-state (TN→TN) PDF text (excerpt) ---\n");
  console.log(sameStateText.substring(0, 800));

  // Tax math: 100 * 1000 = 100000 taxable, 18% = 18000 total
  // CGST = 9000 (9%), SGST = 9000 (9%), IGST = 0
  const taxable = 100 * 1000;
  const expectedCgst = taxable * 0.09;  // 9000
  const expectedSgst = taxable * 0.09;  // 9000
  const expectedGrandTotal = taxable + 18000 + 500 + 100 + 50;

  check("Same-state (TN→TN): 'CGST Val' column present", sameStateText.includes("CGST Val"));
  check("Same-state (TN→TN): 'SGST Val' column present", sameStateText.includes("SGST Val"));
  check("Same-state (TN→TN): NO 'IGST Val' column", !sameStateText.includes("IGST Val"));
  check("Same-state (TN→TN): CGST = ₹9,000.00", sameStateText.includes(formatIndianCurrency(expectedCgst)));
  check("Same-state (TN→TN): SGST = ₹9,000.00", sameStateText.includes(formatIndianCurrency(expectedSgst)));
  check("Same-state (TN→TN): NO tax warning", !sameStateText.includes("TAX WARNING"));

  // ══════════════════════════════════════════════════════════════════════════
  // Test 2: DIFFERENT STATE — Customer in Kerala, Supplier in Tamil Nadu
  //   Expected: INTER-STATE → IGST 18% = ₹18,000
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n=== Test 2: DIFFERENT STATE (TN→KL) — expect IGST ===\n");

  const diffStateDoc = generateSukiQuotationPdf({
    quotationCode: "QT-TEST-DIFF-STATE",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-22"),
    customer: {
      name: "Kerala Customer Pvt Ltd",
      customerCode: "KL-001",
      billingAddress: "Marine Drive, Kochi",
      city: "Kochi",
      state: "Kerala",
      gstNumber: "32AABCK1234D1Z5",
      phone: "9876543211",
      email: "kerala@test.com",
    },
    contact: { name: "Kerala Contact", phone: "9876543211" },
    company: { name: "Shahnaz Bright Steel Industries Pvt Ltd" },
    items: [{
      description: "SS304 Round Bar",
      productType: "Bright Bar",
      rmMake: "SAIL",
      numberOfPieces: 10,
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      cuttingCharge: 500,
      remarks: "Different-state (TN→KL) — should be IGST",
      unit: "kgs",
    }],
    transportCharge: 100,
    otherCharges: 50,
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
    placeOfSupply: "Kerala",
    shipState: "Kerala",
    shipGstNumber: "32AABCK1234D1Z5",
  });

  const diffStateText = await extractPdfText(diffStateDoc.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\QT-TEST-DIFF-STATE-TN-KL.pdf", Buffer.from(diffStateDoc.output("arraybuffer")));

  console.log("\n--- Different-state (TN→KL) PDF text (excerpt) ---\n");
  console.log(diffStateText.substring(0, 800));

  const expectedIgst = taxable * 0.18;  // 18000

  check("Different-state (TN→KL): 'IGST Val' column present", diffStateText.includes("IGST Val"));
  check("Different-state (TN→KL): NO 'CGST Val' column", !diffStateText.includes("CGST Val"));
  check("Different-state (TN→KL): NO 'SGST Val' column", !diffStateText.includes("SGST Val"));
  check("Different-state (TN→KL): IGST = ₹18,000.00 (full 18%)", diffStateText.includes(formatIndianCurrency(expectedIgst)));
  check("Different-state (TN→KL): NO tax warning", !diffStateText.includes("TAX WARNING"));

  // Grand total should be identical (tax amount is the same regardless of split)
  check("Grand Total: same-state == different-state (same amount owed)", expectedGrandTotal === taxable + expectedIgst + 500 + 100 + 50);

  // ══════════════════════════════════════════════════════════════════════════
  // Test 3: UNKNOWN — no state, no GSTIN → PDF generation BLOCKED (throws)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n=== Test 3: UNKNOWN state — expect PDF generation to THROW ===\n");

  let unknownThrew = false;
  let unknownErrMsg = "";
  try {
    generateSukiQuotationPdf({
      quotationCode: "QT-TEST-UNKNOWN",
      revisionNumber: 1,
      status: "Draft",
      validUntil: new Date("2026-12-31"),
      createdAt: new Date("2026-08-22"),
      customer: {
        name: "Unknown State Customer",
        customerCode: "UNK-001",
        billingAddress: "Some address",
        city: "Some city",
        state: null,
        gstNumber: null,
        phone: "9876543212",
      },
      contact: { name: "Unknown Contact", phone: "9876543212" },
      company: { name: "Shahnaz Bright Steel Industries Pvt Ltd" },
      items: [{
        description: "SS304 Round Bar",
        quantity: 100,
        unitPrice: 1000,
        taxPercent: 18,
        unit: "kgs",
      }],
      termsAndConditions: "Test T&C",
      companyGstin: COMPANY_GSTIN,
      generatedByName: "Test",
    });
  } catch (err: any) {
    unknownThrew = true;
    unknownErrMsg = err.message;
  }
  check("Unknown: PDF generation throws (does NOT silently default)", unknownThrew);
  check("Unknown: error message mentions 'could not be determined'", unknownErrMsg.includes("could not be determined"));

  // ══════════════════════════════════════════════════════════════════════════
  // Test 4: STATE MISMATCH — GSTIN says Kerala (32), state field says Tamil Nadu
  //   Supplier TN (33), PoS from GSTIN = Kerala (32) → inter-state → IGST
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n=== Test 4: STATE MISMATCH (GSTIN=Kerala, field=TN) ===\n");

  const mismatchDoc = generateSukiQuotationPdf({
    quotationCode: "QT-TEST-MISMATCH",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-22"),
    customer: {
      name: "Mismatch Customer",
      customerCode: "MM-001",
      billingAddress: "Some address",
      city: "Chennai",
      state: "Tamil Nadu",  // field says Tamil Nadu
      gstNumber: "32AABCM9999F1Z5",  // but GSTIN says Kerala (32)
      phone: "9876543213",
    },
    contact: { name: "Mismatch Contact", phone: "9876543213" },
    company: { name: "Shahnaz Bright Steel Industries Pvt Ltd" },
    items: [{
      description: "SS304 Round Bar",
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      unit: "kgs",
    }],
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
  });

  const mismatchText = await extractPdfText(mismatchDoc.output("arraybuffer"));
  // GSTIN state (32=Kerala) ≠ Supplier (33=TN) → inter-state → IGST
  check("Mismatch: 'DATA WARNING' present", mismatchText.includes("DATA WARNING"));
  check("Mismatch: GSTIN wins → IGST (inter-state, TN→KL)", mismatchText.includes("IGST Val"));
  check("Mismatch: NO CGST (GSTIN state used, not field)", !mismatchText.includes("CGST Val"));

  // ══════════════════════════════════════════════════════════════════════════
  // Test 5: UNIT TESTS — resolveTaxTreatment + computeGstSplit
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n=== Test 5: resolveTaxTreatment + computeGstSplit unit tests ===\n");

  // 5a: Supplier TN, PoS TN → intra_state
  const r1 = resolveTaxTreatment(COMPANY_GSTIN, "Tamil Nadu", null, null, null, null);
  check("Unit: TN→TN = intra_state", r1.treatment === "intra_state", `treatment=${r1.treatment}`);
  check("Unit: TN→TN PoS code = 33", r1.placeOfSupplyStateCode === "33");

  // 5b: Supplier TN, PoS Kerala → inter_state
  const r2 = resolveTaxTreatment(COMPANY_GSTIN, "Kerala", null, null, null, null);
  check("Unit: TN→KL = inter_state", r2.treatment === "inter_state", `treatment=${r2.treatment}`);
  check("Unit: TN→KL PoS code = 32", r2.placeOfSupplyStateCode === "32");

  // 5c: Supplier TN, PoS Andhra Pradesh → inter_state
  const r2b = resolveTaxTreatment(COMPANY_GSTIN, "Andhra Pradesh", null, null, null, null);
  check("Unit: TN→AP = inter_state", r2b.treatment === "inter_state", `treatment=${r2b.treatment}`);
  check("Unit: TN→AP PoS code = 37", r2b.placeOfSupplyStateCode === "37");

  // 5d: No PoS info → unknown
  const r3 = resolveTaxTreatment(COMPANY_GSTIN, null, null, null, null, null);
  check("Unit: no info = unknown", r3.treatment === "unknown", `treatment=${r3.treatment}`);
  check("Unit: unknown has warning", !!r3.warning);

  // 5e: No company GSTIN → unknown
  const r4 = resolveTaxTreatment(null, "Tamil Nadu", null, null, null, null);
  check("Unit: no company GSTIN = unknown", r4.treatment === "unknown");
  check("Unit: no company GSTIN warning mentions company_gstin", !!r4.warning && r4.warning.includes("company_gstin"));

  // 5f: computeGstSplit — intra_state (TN→TN)
  const splitIntra = computeGstSplit(100000, 18, "intra_state");
  check("Split: intra CGST = 9000 (9% of 100000)", splitIntra.cgst === 9000, `got ${splitIntra.cgst}`);
  check("Split: intra SGST = 9000 (9% of 100000)", splitIntra.sgst === 9000, `got ${splitIntra.sgst}`);
  check("Split: intra IGST = 0", splitIntra.igst === 0);
  check("Split: intra totalTax = 18000", splitIntra.totalTax === 18000, `got ${splitIntra.totalTax}`);

  // 5g: computeGstSplit — inter_state (TN→KL)
  const splitInter = computeGstSplit(100000, 18, "inter_state");
  check("Split: inter CGST = 0", splitInter.cgst === 0);
  check("Split: inter SGST = 0", splitInter.sgst === 0);
  check("Split: inter IGST = 18000 (18% of 100000)", splitInter.igst === 18000, `got ${splitInter.igst}`);
  check("Split: inter totalTax = 18000", splitInter.totalTax === 18000, `got ${splitInter.totalTax}`);

  // 5h: Never both types populated simultaneously
  check("Split: intra — IGST is 0 (not both types)", splitIntra.igst === 0);
  check("Split: inter — CGST+SGST are 0 (not both types)", splitInter.cgst === 0 && splitInter.sgst === 0);

  // ══════════════════════════════════════════════════════════════════════════
  // Test 6: PROFORMA PDF — same logic
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n=== Test 6: Proforma PDF — inter-state (TN→KL) IGST ===\n");

  const proformaInterDoc = generateProformaPdf({
    proformaCode: "PI-TEST-INTER-TN-KL",
    proformaDate: new Date("2026-08-22"),
    status: "Draft",
    customer: {
      name: "Kerala Customer Pvt Ltd",
      customerCode: "KL-001",
      billingAddress: "Marine Drive, Kochi",
      city: "Kochi",
      state: "Kerala",
      gstNumber: "32AABCK1234D1Z5",
      phone: "9876543211",
    },
    contact: { name: "Kerala Contact", phone: "9876543211" },
    company: { name: "Shahnaz Bright Steel Industries Pvt Ltd" },
    quotationCode: "QT-TEST-DIFF-STATE",
    items: [{
      description: "SS304 Round Bar",
      productType: "Bright Bar",
      rmMake: "SAIL",
      numberOfPieces: 10,
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      cuttingCharge: 500,
      deliveryDays: 7,
      remarks: "Inter-state proforma (TN→KL)",
      unit: "kgs",
    }],
    subtotal: 100000,
    taxAmount: 18000,
    discountPercent: 0,
    grandTotal: 118650,
    transportCharge: 100,
    otherCharges: 50,
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
    placeOfSupply: "Kerala",
    shipState: "Kerala",
    shipGstNumber: "32AABCK1234D1Z5",
  });

  const proformaInterText = await extractPdfText(proformaInterDoc.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\PI-TEST-INTER-TN-KL.pdf", Buffer.from(proformaInterDoc.output("arraybuffer")));
  check("Proforma inter-state (TN→KL): 'IGST Val' present", proformaInterText.includes("IGST Val"));
  check("Proforma inter-state (TN→KL): NO 'CGST Val'", !proformaInterText.includes("CGST Val"));
  check("Proforma inter-state (TN→KL): NO 'SGST Val'", !proformaInterText.includes("SGST Val"));

  console.log("\n=== Test 6b: Proforma PDF — intra-state (TN→TN) CGST+SGST ===\n");

  const proformaIntraDoc = generateProformaPdf({
    proformaCode: "PI-TEST-INTRA-TN-TN",
    proformaDate: new Date("2026-08-22"),
    status: "Draft",
    customer: {
      name: "Tamil Nadu Customer Pvt Ltd",
      customerCode: "TN-001",
      billingAddress: "Industrial Estate, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
      gstNumber: "33AABCT5678E1Z5",
      phone: "9876543210",
    },
    contact: { name: "TN Contact", phone: "9876543210" },
    company: { name: "Shahnaz Bright Steel Industries Pvt Ltd" },
    quotationCode: "QT-TEST-SAME-STATE",
    items: [{
      description: "SS304 Round Bar",
      productType: "Bright Bar",
      rmMake: "SAIL",
      numberOfPieces: 10,
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      cuttingCharge: 500,
      deliveryDays: 7,
      remarks: "Intra-state proforma (TN→TN)",
      unit: "kgs",
    }],
    subtotal: 100000,
    taxAmount: 18000,
    discountPercent: 0,
    grandTotal: 118650,
    transportCharge: 100,
    otherCharges: 50,
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
    placeOfSupply: "Tamil Nadu",
    shipState: "Tamil Nadu",
    shipGstNumber: "33AABCT5678E1Z5",
  });

  const proformaIntraText = await extractPdfText(proformaIntraDoc.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\PI-TEST-INTRA-TN-TN.pdf", Buffer.from(proformaIntraDoc.output("arraybuffer")));
  check("Proforma intra-state (TN→TN): 'CGST Val' present", proformaIntraText.includes("CGST Val"));
  check("Proforma intra-state (TN→TN): 'SGST Val' present", proformaIntraText.includes("SGST Val"));
  check("Proforma intra-state (TN→TN): NO 'IGST Val'", !proformaIntraText.includes("IGST Val"));

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

function formatIndianCurrency(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
