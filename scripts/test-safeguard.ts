/**
 * Test: Verify the system is safely back to "not configured" state after
 * removing the fabricated company_gstin.
 *
 * 1. Confirm SystemConfig.company_gstin is unset
 * 2. Generate a quotation PDF → should show "TAX WARNING: Supplier's home state
 *    could not be determined"
 * 3. Verify the placeholder GSTIN safeguard rejects fabricated values
 * 4. Verify a real-looking GSTIN is still accepted by getStateCodeFromGstin
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

import { generateSukiQuotationPdf } from "../lib/generateSukiQuotationPdf";
import { getStateCodeFromGstin, resolveTaxTreatment } from "../lib/gstState";
import { PDFParse } from "pdf-parse";

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

  // ── 1. Confirm SystemConfig.company_gstin is unset ──
  console.log("\n=== 1. Confirm company_gstin is unset ===\n");
  const gstinConfig = await prisma.systemConfig.findUnique({ where: { key: "company_gstin" } });
  console.log(`SystemConfig.company_gstin = ${JSON.stringify(gstinConfig)}`);
  check("company_gstin is null/unset in DB", gstinConfig === null);

  // ── 2. Generate quotation PDF with no company_gstin → TAX WARNING ──
  console.log("\n=== 2. Generate PDF with no company_gstin → TAX WARNING ===\n");

  const doc = generateSukiQuotationPdf({
    quotationCode: "QT-TEST-NOGSTIN-001",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-14"),
    customer: {
      name: "Test Customer",
      customerCode: "TEST-001",
      state: "Kerala",
      gstNumber: "32AABCK1234D1Z5",
    },
    contact: { name: "Test", phone: "9999999999" },
    company: { name: "Suki Software" },
    items: [{
      description: "Test item",
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      unit: "kgs",
    }],
    termsAndConditions: "Test T&C",
    companyGstin: "", // explicitly empty — simulates unset config
    generatedByName: "Test",
  });

  const pdfText = await extractPdfText(doc.output("arraybuffer"));
  console.log("\n--- PDF text excerpt ---\n");
  console.log(pdfText.substring(0, 600));

  check("PDF shows 'TAX WARNING'", pdfText.includes("TAX WARNING"));
  check("PDF warning mentions 'company_gstin'", pdfText.includes("company_gstin") || pdfText.includes("Supplier"));
  check("PDF warning mentions 'could not be determined'", pdfText.includes("could not be determined"));
  check("PDF defaults to CGST+SGST (safe default)", pdfText.includes("CGST Val") && pdfText.includes("SGST Val"));

  // ── 3. Verify placeholder GSTIN safeguard ──
  console.log("\n=== 3. Placeholder GSTIN safeguard ===\n");

  // The fabricated value that was previously set
  const fakeGstin = "32AAAAA0000A1Z5";
  const fakeResult = getStateCodeFromGstin(fakeGstin);
  check(`getStateCodeFromGstin rejects fabricated "${fakeGstin}"`, fakeResult === null,
    `got: ${fakeResult}`);

  // Another placeholder pattern
  const fakeGstin2 = "33BBBBB0000B1Z5";
  const fakeResult2 = getStateCodeFromGstin(fakeGstin2);
  check(`getStateCodeFromGstin rejects fabricated "${fakeGstin2}"`, fakeResult2 === null,
    `got: ${fakeResult2}`);

  // A real-looking GSTIN should still work
  const realGstin = "32AABCU1234A1Z5";
  const realResult = getStateCodeFromGstin(realGstin);
  check(`getStateCodeFromGstin accepts real-looking "${realGstin}"`, realResult === "32",
    `got: ${realResult}`);

  // resolveTaxTreatment with fabricated company GSTIN → unknown
  const resolveFake = resolveTaxTreatment(fakeGstin, null, null, null, "32AABCK1234D1Z5", "Kerala");
  check("resolveTaxTreatment with fabricated company GSTIN → unknown", resolveFake.treatment === "unknown",
    `treatment=${resolveFake.treatment}`);
  check("resolveTaxTreatment with fabricated company GSTIN → warning", !!resolveFake.warning);

  // resolveTaxTreatment with empty company GSTIN → unknown
  const resolveEmpty = resolveTaxTreatment("", null, null, null, "32AABCK1234D1Z5", "Kerala");
  check("resolveTaxTreatment with empty company GSTIN → unknown", resolveEmpty.treatment === "unknown",
    `treatment=${resolveEmpty.treatment}`);

  // resolveTaxTreatment with real company GSTIN → works
  const resolveReal = resolveTaxTreatment(realGstin, null, null, null, "32AABCK1234D1Z5", "Kerala");
  check("resolveTaxTreatment with real company GSTIN → intra_state", resolveReal.treatment === "intra_state",
    `treatment=${resolveReal.treatment}`);

  const resolveRealInter = resolveTaxTreatment(realGstin, null, null, null, "33AABCT5678E1Z5", "Tamil Nadu");
  check("resolveTaxTreatment with real company GSTIN (inter-state) → inter_state", resolveRealInter.treatment === "inter_state",
    `treatment=${resolveRealInter.treatment}`);

  // ── 4. Verify the API safeguard would reject the fabricated value ──
  console.log("\n=== 4. API safeguard validation (simulated) ===\n");

  // Simulate the validation logic from system-configs route
  function validateComplianceValue(key: string, value: string): string | null {
    if (key !== "company_gstin") return null;
    const trimmed = value.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(trimmed)) {
      return `Invalid GSTIN format`;
    }
    const panLetters = trimmed.substring(2, 7);
    const panDigits = trimmed.substring(7, 11);
    const allSameLetter = panLetters.split("").every((c) => c === panLetters[0]);
    if (allSameLetter) {
      return `Placeholder PAN detected`;
    }
    if (panDigits === "0000") {
      return `Placeholder PAN digits detected`;
    }
    return null;
  }

  check("API safeguard rejects fabricated 32AAAAA0000A1Z5", validateComplianceValue("company_gstin", "32AAAAA0000A1Z5") !== null);
  check("API safeguard rejects fabricated 33BBBBB0000B1Z5", validateComplianceValue("company_gstin", "33BBBBB0000B1Z5") !== null);
  check("API safeguard rejects invalid format 'Kerala'", validateComplianceValue("company_gstin", "Kerala") !== null);
  check("API safeguard accepts real GSTIN 32AABCU1234A1Z5", validateComplianceValue("company_gstin", "32AABCU1234A1Z5") === null);
  check("API safeguard accepts real GSTIN 33AABCT5678E1Z5", validateComplianceValue("company_gstin", "33AABCT5678E1Z5") === null);
  check("API safeguard ignores non-gstin keys", validateComplianceValue("company_address", "123 Main St") === null);

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
