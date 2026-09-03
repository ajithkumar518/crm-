/**
 * Direct verification: 2 scenarios with real Shahnaz GSTIN
 * Generates PDFs and extracts text to prove tax type is correct.
 */
import { generateSukiQuotationPdf } from "../lib/generateSukiQuotationPdf";
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
  const COMPANY_GSTIN = "33ABACS6559E1ZD";
  const supplierCode = getStateCodeFromGstin(COMPANY_GSTIN);
  console.log("=".repeat(80));
  console.log("DIRECT VERIFICATION — Real Shahnaz GSTIN");
  console.log("=".repeat(80));
  console.log(`Supplier GSTIN: ${COMPANY_GSTIN}`);
  console.log(`Supplier State Code: ${supplierCode} (Tamil Nadu)`);
  console.log();

  // ─── Scenario A: Supplier TN, Customer Kerala → IGST ───────────────────
  console.log("─".repeat(80));
  console.log("SCENARIO A: Supplier=TN(33), Customer=Kerala(32) → expect IGST 18%");
  console.log("─".repeat(80));

  const rA = resolveTaxTreatment(COMPANY_GSTIN, "Kerala", "32AABCK1234D1Z5", "Kerala", "32AABCK1234D1Z5", "Kerala");
  console.log(`  resolveTaxTreatment: treatment=${rA.treatment}, supplierCode=${rA.supplierStateCode}, posCode=${rA.placeOfSupplyStateCode}`);
  console.log(`  Comparison: posCode(${rA.placeOfSupplyStateCode}) === supplierCode(${rA.supplierStateCode}) ? ${rA.placeOfSupplyStateCode === rA.supplierStateCode} → ${rA.treatment}`);

  const splitA = computeGstSplit(100000, 18, rA.treatment);
  console.log(`  computeGstSplit(100000, 18, ${rA.treatment}): cgst=${splitA.cgst}, sgst=${splitA.sgst}, igst=${splitA.igst}, totalTax=${splitA.totalTax}`);

  const docA = generateSukiQuotationPdf({
    quotationCode: "VERIFY-TN-KL",
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
      remarks: "TN→KL verification",
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

  const textA = await extractPdfText(docA.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\VERIFY-TN-KL-IGST.pdf", Buffer.from(docA.output("arraybuffer")));

  // Extract the item table portion
  const tableStartA = textA.indexOf("S.No");
  const tableEndA = textA.indexOf("Total", tableStartA);
  const tableA = textA.substring(tableStartA, tableEndA > 0 ? tableEndA + 200 : tableStartA + 400);

  console.log("\n  --- PDF Item Table Excerpt ---");
  console.log("  " + tableA.replace(/\n/g, "\n  "));
  console.log();

  console.log("  ASSERTIONS:");
  console.log(`    ✓ IGST Val column present: ${textA.includes("IGST Val")}`);
  console.log(`    ✓ CGST Val column absent:  ${!textA.includes("CGST Val")}`);
  console.log(`    ✓ SGST Val column absent:  ${!textA.includes("SGST Val")}`);
  console.log(`    ✓ IGST = ₹18,000.00:       ${textA.includes("₹18,000.00")}`);
  console.log(`    ✓ CGST = 0 (not present):  ${!textA.includes("₹9,000.00")}`);
  console.log(`    PDF saved: C:\\Users\\ajithkumar\\Downloads\\VERIFY-TN-KL-IGST.pdf`);

  // ─── Scenario B: Supplier TN, Customer TN → CGST+SGST ──────────────────
  console.log("\n" + "─".repeat(80));
  console.log("SCENARIO B: Supplier=TN(33), Customer=TN(33) → expect CGST 9% + SGST 9%");
  console.log("─".repeat(80));

  const rB = resolveTaxTreatment(COMPANY_GSTIN, "Tamil Nadu", "33AABCT5678E1Z5", "Tamil Nadu", "33AABCT5678E1Z5", "Tamil Nadu");
  console.log(`  resolveTaxTreatment: treatment=${rB.treatment}, supplierCode=${rB.supplierStateCode}, posCode=${rB.placeOfSupplyStateCode}`);
  console.log(`  Comparison: posCode(${rB.placeOfSupplyStateCode}) === supplierCode(${rB.supplierStateCode}) ? ${rB.placeOfSupplyStateCode === rB.supplierStateCode} → ${rB.treatment}`);

  const splitB = computeGstSplit(100000, 18, rB.treatment);
  console.log(`  computeGstSplit(100000, 18, ${rB.treatment}): cgst=${splitB.cgst}, sgst=${splitB.sgst}, igst=${splitB.igst}, totalTax=${splitB.totalTax}`);

  const docB = generateSukiQuotationPdf({
    quotationCode: "VERIFY-TN-TN",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-22"),
    customer: {
      name: "Tamil Nadu Industries Ltd",
      customerCode: "TN-001",
      billingAddress: "Industrial Estate, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
      gstNumber: "33AABCT5678E1Z5",
      phone: "9876543210",
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
      remarks: "TN→TN verification",
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

  const textB = await extractPdfText(docB.output("arraybuffer"));
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\VERIFY-TN-TN-CGST-SGST.pdf", Buffer.from(docB.output("arraybuffer")));

  const tableStartB = textB.indexOf("S.No");
  const tableEndB = textB.indexOf("Total", tableStartB);
  const tableB = textB.substring(tableStartB, tableEndB > 0 ? tableEndB + 200 : tableStartB + 400);

  console.log("\n  --- PDF Item Table Excerpt ---");
  console.log("  " + tableB.replace(/\n/g, "\n  "));
  console.log();

  console.log("  ASSERTIONS:");
  console.log(`    ✓ CGST Val column present: ${textB.includes("CGST Val")}`);
  console.log(`    ✓ SGST Val column present: ${textB.includes("SGST Val")}`);
  console.log(`    ✓ IGST Val column absent:  ${!textB.includes("IGST Val")}`);
  console.log(`    ✓ CGST = ₹9,000.00:        ${textB.includes("₹9,000.00")}`);
  console.log(`    ✓ SGST = ₹9,000.00:        ${textB.includes("₹9,000.00")}`);
  console.log(`    ✓ IGST = 0 (not present):  ${!textB.includes("₹18,000.00")}`);
  console.log(`    PDF saved: C:\\Users\\ajithkumar\\Downloads\\VERIFY-TN-TN-CGST-SGST.pdf`);

  console.log("\n" + "=".repeat(80));
  console.log("VERIFICATION COMPLETE");
  console.log("=".repeat(80));
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
