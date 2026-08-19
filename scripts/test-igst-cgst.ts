// @ts-nocheck
/**
 * Test: IGST vs CGST+SGST tax treatment for intra-state and inter-state customers.
 *
 * Supplier: Suki Software, GSTIN 32AAAAA0000A1Z5 (Kerala, state code 32)
 *
 * Test cases:
 * 1. Intra-state: Customer in Kerala (state code 32) → CGST + SGST split
 * 2. Inter-state: Customer in Tamil Nadu (state code 33) → IGST single line
 * 3. Unknown: Customer with no state and no GSTIN → warning shown
 * 4. State mismatch: Customer GSTIN says Kerala but state field says Tamil Nadu → warning + GSTIN wins
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

import { generateSukiQuotationPdf } from "../lib/generateSukiQuotationPdf";
import { generateProformaPdf } from "../lib/generateProformaPdf";
import { resolveTaxTreatment, getStateCodeFromGstin } from "../lib/gstState";
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

  const COMPANY_GSTIN = "32AAAAA0000A1Z5";
  const supplierStateCode = getStateCodeFromGstin(COMPANY_GSTIN);
  console.log(`\nSupplier GSTIN: ${COMPANY_GSTIN} → state code: ${supplierStateCode} (Kerala)`);

  // ── Test 1: Intra-state (Kerala customer) — should show CGST + SGST ──
  console.log("\n=== Test 1: Intra-state (Kerala customer) — CGST + SGST ===\n");

  const intraStateDoc = generateSukiQuotationPdf({
    quotationCode: "QT-TEST-INTRA-001",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-14"),
    customer: {
      name: "Kerala Customer Pvt Ltd",
      customerCode: "KL-001",
      billingAddress: "Marine Drive, Kochi",
      city: "Kochi",
      state: "Kerala",
      gstNumber: "32AABCK1234D1Z5",
      phone: "9876543210",
      email: "kerala@test.com",
    },
    contact: { name: "Kerala Contact", phone: "9876543210" },
    company: { name: "Suki Software" },
    items: [{
      description: "SS304 Round Bar",
      productType: "Bright Bar",
      rmMake: "SAIL",
      numberOfPieces: 10,
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      cuttingCharge: 500,
      remarks: "Intra-state test",
      unit: "kgs",
    }],
    transportCharge: 100,
    otherCharges: 50,
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
  });

  const intraStateText = await extractPdfText(intraStateDoc.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\QT-TEST-INTRA-001.pdf", Buffer.from(intraStateDoc.output("arraybuffer")));

  console.log("\n--- Intra-state PDF text (excerpt) ---\n");
  console.log(intraStateText.substring(0, 800));

  // Tax math: 100 * 1000 = 100000 taxable, 18% tax = 18000, CGST = 9000, SGST = 9000
  const intraTaxable = 100 * 1000;
  const intraTax = intraTaxable * 0.18;
  const intraCgst = intraTax / 2;
  const intraSgst = intraTax / 2;
  const intraGrandTotal = intraTaxable + intraTax + 500 + 100 + 50; // taxable + tax + cutting + transport + other

  check("Intra-state: 'CGST Val' column present", intraStateText.includes("CGST Val"));
  check("Intra-state: 'SGST Val' column present", intraStateText.includes("SGST Val"));
  check("Intra-state: NO 'IGST Val' column", !intraStateText.includes("IGST Val"));
  check("Intra-state: CGST value = ₹9,000.00", intraStateText.includes(formatIndianCurrency(intraCgst)));
  check("Intra-state: SGST value = ₹9,000.00", intraStateText.includes(formatIndianCurrency(intraSgst)));
  check("Intra-state: 'Tax Charges' label in summary", intraStateText.includes("Tax Charges"));
  check("Intra-state: NO 'IGST' label in summary", !intraStateText.match(/^IGST$/m));
  check("Intra-state: Grand Total correct", intraStateText.includes(formatIndianCurrency(intraGrandTotal)));
  check("Intra-state: NO tax warning", !intraStateText.includes("TAX WARNING"));

  // ── Test 2: Inter-state (Tamil Nadu customer) — should show IGST ──
  console.log("\n=== Test 2: Inter-state (Tamil Nadu customer) — IGST ===\n");

  const interStateDoc = generateSukiQuotationPdf({
    quotationCode: "QT-TEST-INTER-001",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-14"),
    customer: {
      name: "Tamil Nadu Industries Ltd",
      customerCode: "TN-001",
      billingAddress: "Industrial Estate, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
      gstNumber: "33AABCT5678E1Z5",
      phone: "9876543211",
      email: "tn@test.com",
    },
    contact: { name: "TN Contact", phone: "9876543211" },
    company: { name: "Suki Software" },
    items: [{
      description: "SS304 Round Bar",
      productType: "Bright Bar",
      rmMake: "SAIL",
      numberOfPieces: 10,
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      cuttingCharge: 500,
      remarks: "Inter-state test",
      unit: "kgs",
    }],
    transportCharge: 100,
    otherCharges: 50,
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
  });

  const interStateText = await extractPdfText(interStateDoc.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\QT-TEST-INTER-001.pdf", Buffer.from(interStateDoc.output("arraybuffer")));

  console.log("\n--- Inter-state PDF text (excerpt) ---\n");
  console.log(interStateText.substring(0, 800));

  // Tax math: same as intra-state, but IGST = full 18000 (no split)
  const interTaxable = 100 * 1000;
  const interTax = interTaxable * 0.18;
  const interIgst = interTax; // full tax amount
  const interGrandTotal = interTaxable + interTax + 500 + 100 + 50; // same grand total

  check("Inter-state: 'IGST Val' column present", interStateText.includes("IGST Val"));
  check("Inter-state: NO 'CGST Val' column", !interStateText.includes("CGST Val"));
  check("Inter-state: NO 'SGST Val' column", !interStateText.includes("SGST Val"));
  check("Inter-state: IGST value = ₹18,000.00 (full tax)", interStateText.includes(formatIndianCurrency(interIgst)));
  check("Inter-state: 'IGST' label in summary", interStateText.includes("IGST"));
  check("Inter-state: NO 'Tax Charges' label in summary", !interStateText.includes("Tax Charges"));
  check("Inter-state: Grand Total identical to intra-state", interStateText.includes(formatIndianCurrency(interGrandTotal)));
  check("Inter-state: NO tax warning", !interStateText.includes("TAX WARNING"));

  // ── Verify Grand Total is identical regardless of split ──
  console.log("\n=== Grand Total comparison ===\n");
  check("Grand Total: intra == inter (same amount owed)", intraGrandTotal === interGrandTotal,
    `intra=${intraGrandTotal}, inter=${interGrandTotal}`);

  // ── Test 3: Unknown state (no GSTIN, no state) — should show warning ──
  console.log("\n=== Test 3: Unknown state (no GSTIN, no state) — warning ===\n");

  const unknownDoc = generateSukiQuotationPdf({
    quotationCode: "QT-TEST-UNKNOWN-001",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-14"),
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
    company: { name: "Suki Software" },
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

  const unknownText = await extractPdfText(unknownDoc.output("arraybuffer"));
  console.log("\n--- Unknown state PDF text (excerpt) ---\n");
  console.log(unknownText.substring(0, 800));

  check("Unknown: 'TAX WARNING' present in PDF", unknownText.includes("TAX WARNING"));
  check("Unknown: warning mentions state/GSTIN", unknownText.includes("state") || unknownText.includes("GSTIN"));
  check("Unknown: defaults to CGST+SGST (safe default)", unknownText.includes("CGST Val") && unknownText.includes("SGST Val"));

  // ── Test 4: State mismatch (GSTIN=Kerala, state field=Tamil Nadu) ──
  console.log("\n=== Test 4: State mismatch (GSTIN=Kerala, field=Tamil Nadu) ===\n");

  const mismatchDoc = generateSukiQuotationPdf({
    quotationCode: "QT-TEST-MISMATCH-001",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-14"),
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
    company: { name: "Suki Software" },
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
  console.log("\n--- State mismatch PDF text (excerpt) ---\n");
  console.log(mismatchText.substring(0, 800));

  // GSTIN state code (32 = Kerala) should win → intra-state → CGST+SGST
  check("Mismatch: 'DATA WARNING' present", mismatchText.includes("DATA WARNING"));
  check("Mismatch: GSTIN wins → CGST+SGST (intra-state)", mismatchText.includes("CGST Val") && mismatchText.includes("SGST Val"));
  check("Mismatch: NO IGST (GSTIN state used, not field)", !mismatchText.includes("IGST Val"));

  // ── Test 5: resolveTaxTreatment unit tests ──
  console.log("\n=== Test 5: resolveTaxTreatment unit tests ===\n");

  const r1 = resolveTaxTreatment(COMPANY_GSTIN, "32AABCK1234D1Z5", "Kerala");
  check("resolve: intra-state (KL→KL)", r1.treatment === "intra_state", `treatment=${r1.treatment}`);

  const r2 = resolveTaxTreatment(COMPANY_GSTIN, "33AABCT5678E1Z5", "Tamil Nadu");
  check("resolve: inter-state (KL→TN)", r2.treatment === "inter_state", `treatment=${r2.treatment}`);

  const r3 = resolveTaxTreatment(COMPANY_GSTIN, null, null);
  check("resolve: unknown (no GSTIN, no state)", r3.treatment === "unknown", `treatment=${r3.treatment}`);
  check("resolve: unknown has warning", !!r3.warning);

  const r4 = resolveTaxTreatment(COMPANY_GSTIN, "32AABCM9999F1Z5", "Tamil Nadu");
  check("resolve: mismatch detected", r4.stateFieldMismatch === true);
  check("resolve: mismatch → GSTIN wins (intra-state)", r4.treatment === "intra_state", `treatment=${r4.treatment}`);

  const r5 = resolveTaxTreatment(null, "32AABCK1234D1Z5", "Kerala");
  check("resolve: no company GSTIN → unknown", r5.treatment === "unknown");
  check("resolve: no company GSTIN → warning about company_gstin", !!r5.warning && r5.warning.includes("company_gstin"));

  const r6 = resolveTaxTreatment(COMPANY_GSTIN, null, "Tamil Nadu");
  check("resolve: no customer GSTIN, state field=TN → inter-state", r6.treatment === "inter_state", `treatment=${r6.treatment}`);

  const r7 = resolveTaxTreatment(COMPANY_GSTIN, null, "Kerala");
  check("resolve: no customer GSTIN, state field=KL → intra-state", r7.treatment === "intra_state", `treatment=${r7.treatment}`);

  // ── Test 6: Proforma PDF — same logic ──
  console.log("\n=== Test 6: Proforma PDF — inter-state IGST ===\n");

  const proformaInterDoc = generateProformaPdf({
    proformaCode: "PI-TEST-INTER-001",
    proformaDate: new Date("2026-08-14"),
    status: "Draft",
    customer: {
      name: "Tamil Nadu Industries Ltd",
      customerCode: "TN-001",
      billingAddress: "Industrial Estate, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
      gstNumber: "33AABCT5678E1Z5",
      phone: "9876543211",
    },
    contact: { name: "TN Contact", phone: "9876543211" },
    company: { name: "Suki Software" },
    quotationCode: "QT-TEST-INTER-001",
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
      remarks: "Inter-state proforma test",
      unit: "kgs",
    }],
    subtotal: 100000,
    taxAmount: 18000,
    discountPercent: 0,
    grandTotal: 118500,
    transportCharge: 100,
    otherCharges: 50,
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
  });

  const proformaInterText = await extractPdfText(proformaInterDoc.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\PI-TEST-INTER-001.pdf", Buffer.from(proformaInterDoc.output("arraybuffer")));

  console.log("\n--- Proforma inter-state PDF text (excerpt) ---\n");
  console.log(proformaInterText.substring(0, 800));

  check("Proforma inter-state: 'IGST Val' column present", proformaInterText.includes("IGST Val"));
  check("Proforma inter-state: NO 'CGST Val' column", !proformaInterText.includes("CGST Val"));
  check("Proforma inter-state: NO 'SGST Val' column", !proformaInterText.includes("SGST Val"));
  check("Proforma inter-state: 'IGST' label in summary", proformaInterText.includes("IGST"));

  // Proforma intra-state
  const proformaIntraDoc = generateProformaPdf({
    proformaCode: "PI-TEST-INTRA-001",
    proformaDate: new Date("2026-08-14"),
    status: "Draft",
    customer: {
      name: "Kerala Customer Pvt Ltd",
      customerCode: "KL-001",
      billingAddress: "Marine Drive, Kochi",
      city: "Kochi",
      state: "Kerala",
      gstNumber: "32AABCK1234D1Z5",
      phone: "9876543210",
    },
    contact: { name: "Kerala Contact", phone: "9876543210" },
    company: { name: "Suki Software" },
    quotationCode: "QT-TEST-INTRA-001",
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
      remarks: "Intra-state proforma test",
      unit: "kgs",
    }],
    subtotal: 100000,
    taxAmount: 18000,
    discountPercent: 0,
    grandTotal: 118500,
    transportCharge: 100,
    otherCharges: 50,
    termsAndConditions: "Test T&C",
    companyGstin: COMPANY_GSTIN,
    generatedByName: "Test",
  });

  const proformaIntraText = await extractPdfText(proformaIntraDoc.output("arraybuffer"));
  check("Proforma intra-state: 'CGST Val' column present", proformaIntraText.includes("CGST Val"));
  check("Proforma intra-state: 'SGST Val' column present", proformaIntraText.includes("SGST Val"));
  check("Proforma intra-state: NO 'IGST Val' column", !proformaIntraText.includes("IGST Val"));

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

function formatIndianCurrency(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
