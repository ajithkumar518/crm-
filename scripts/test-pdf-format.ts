/**
 * Test: Generate a PDF for QT-2026-00007 using the corrected generator
 * and extract its text to compare against the reference CORRECT_FORMAT.pdf.
 *
 * Also tests Amount In Words for 2 amounts (including lakhs).
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

import { generateSukiQuotationPdf } from "../lib/generateSukiQuotationPdf";
import { PDFParse } from "pdf-parse";
import { writeFileSync } from "fs";

// Import the toIndianWords function indirectly by testing the generator output
// We'll test Amount In Words by creating synthetic quotations with known amounts

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

  // ── Test 1: Generate PDF for QT-2026-00007 ──
  console.log("\n=== Test 1: Generate PDF for QT-2026-00007 ===\n");

  const quotation = await prisma.quotation.findFirst({
    where: { quotationCode: "QT-2026-00007", deletedAt: null },
    include: {
      items: true,
      customer: { select: { id: true, name: true, email: true, customerCode: true, billingAddress: true, shippingAddress: true, city: true, state: true, gstNumber: true, phone: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, dealName: true, opportunityCode: true } },
      company: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!quotation) {
    console.log("QT-2026-00007 not found — creating a test quotation with same data");
    process.exit(1);
  }

  console.log(`Found: ${quotation.quotationCode}, status=${quotation.status}, items=${quotation.items.length}`);
  console.log(`Customer: ${quotation.customer?.name}, code=${quotation.customer?.customerCode}`);
  console.log(`Item 1: desc=${quotation.items[0]?.description}, qty=${quotation.items[0]?.quantity}, unitPrice=${quotation.items[0]?.unitPrice}, taxPercent=${quotation.items[0]?.taxPercent}`);

  const [addrConfig, gstinConfig, phoneConfig, emailConfig] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "company_address" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_gstin" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_phone" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_email" } }),
  ]);

  const doc = generateSukiQuotationPdf({
    quotationCode: quotation.quotationCode,
    revisionNumber: quotation.revisionNumber,
    status: quotation.status,
    validUntil: quotation.validUntil,
    createdAt: quotation.createdAt,
    termsAndConditions: quotation.termsAndConditions,
    paymentTerms: quotation.paymentTerms,
    deliveryTerms: quotation.deliveryTerms,
    freightTerms: quotation.freightTerms,
    leadTimeDays: quotation.leadTimeDays,
    transportCharge: (quotation as any).transportCharge,
    otherCharges: (quotation as any).otherCharges,
    weighingLoadingCharge: (quotation as any).weighingLoadingCharge,
    deliveryCharge: (quotation as any).deliveryCharge,
    testingCharge: (quotation as any).testingCharge,
    customer: quotation.customer as any,
    contact: quotation.contact as any,
    company: quotation.company as any,
    items: quotation.items as any,
    companyAddress: addrConfig?.value || "",
    companyGstin: gstinConfig?.value || "",
    companyPhone: phoneConfig?.value || "",
    companyEmail: emailConfig?.value || "",
    generatedByName: "Test",
  });

  const pdfBytes = doc.output("arraybuffer");
  writeFileSync("C:\\Users\\ajithkumar\\Downloads\\QT-2026-00007-CORRECTED.pdf", Buffer.from(pdfBytes));
  console.log("PDF saved to Downloads\\QT-2026-00007-CORRECTED.pdf");

  const extractedText = await extractPdfText(pdfBytes);
  console.log("\n--- Extracted text from corrected PDF ---\n");
  console.log(extractedText);

  // ── Field-by-field comparison against CORRECT_FORMAT.pdf ──
  console.log("\n=== Field-by-field comparison ===\n");

  check("Header: 'SBS' present", extractedText.includes("SBS"));
  check("Header: 'Suki Software' present", extractedText.includes("Suki Software"));
  check("Header: 'Quotation No : QT-2026-00007' present", extractedText.includes("Quotation No : QT-2026-00007"));
  check("Header: 'Quotation Date' present", extractedText.includes("Quotation Date"));
  check("Header: 'Contact Person' present", extractedText.includes("Contact Person"));
  check("Header: 'Contact No' present", extractedText.includes("Contact No"));
  check("Header: 'Payment Terms' present", extractedText.includes("Payment Terms"));
  check("Header: 'Delivery Terms' present", extractedText.includes("Delivery Terms"));
  check("Header: 'Delivery Period' present", extractedText.includes("Delivery Period"));
  check("Header: NO 'Revision' on printed doc", !extractedText.includes("Revision: R"));
  check("Header: NO 'Status:' label on printed doc", !extractedText.match(/Status:\s/));

  check("BILL TO present", extractedText.includes("BILL TO"));
  check("SHIP TO present", extractedText.includes("SHIP TO"));
  check("Customer code 'ACC-00007' present", extractedText.includes("ACC-00007"));
  check("NO email in BILL TO section", !extractedText.match(/BILL TO[\s\S]*Email:/));

  check("Column: 'S.No' present", extractedText.includes("S.No"));
  check("Column: 'Material' / 'Description' present", extractedText.includes("Material") && extractedText.includes("Description"));
  check("Column: 'Item Code' present", extractedText.includes("Item") && extractedText.includes("Code"));
  check("Column: 'Make' present", extractedText.includes("Make"));
  check("Column: 'No of Pcs' present", extractedText.includes("No of") && extractedText.includes("Pcs"));
  check("Column: 'Qty' present", extractedText.includes("Qty"));
  check("Column: 'UOM' present", extractedText.includes("UOM"));
  check("Column: 'Price' present", extractedText.includes("Price"));
  check("Column: 'Tax Val' present", extractedText.includes("Tax Val"));
  check("Column: 'CGST Val' present", extractedText.includes("CGST Val"));
  check("Column: 'SGST Val' present", extractedText.includes("SGST Val"));
  check("Column: 'Cutting Charge' present", extractedText.includes("Cutting") && extractedText.includes("Charge"));
  check("Column: 'Total Amount' present", extractedText.includes("Total") && extractedText.includes("Amount"));
  check("Column: 'Remarks' present", extractedText.includes("Remarks"));

  check("Totals: 'Taxable Val' present", extractedText.includes("Taxable Val"));
  check("Totals: 'Tax Charges' present", extractedText.includes("Tax Charges"));
  check("Totals: 'Transport Charges' present", extractedText.includes("Transport Charges"));
  check("Totals: 'Other Charges' present", extractedText.includes("Other Charges"));
  check("Totals: 'Weighing/Loading Charge' present", extractedText.includes("Weighing/Loading Charge"));
  check("Totals: 'Delivery Charge' present", extractedText.includes("Delivery Charge"));
  check("Totals: 'Testing Charge' present", extractedText.includes("Testing Charge"));
  check("Totals: 'Total Amount' present", extractedText.includes("Total Amount"));

  check("Amount In Words present", extractedText.includes("Amount In Words"));
  check("Comments field present", extractedText.includes("Comments"));

  check("NO 'Gross Total' (old format)", !extractedText.includes("Gross Total"));
  check("NO 'Net Subtotal' (old format)", !extractedText.includes("Net Subtotal"));
  check("NO 'Tax (GST)' (old format)", !extractedText.includes("Tax (GST)"));
  check("NO 'QUOTATION' header label (old format)", !extractedText.startsWith("QUOTATION"));

  // ── T&C lines ──
  console.log("\n=== T&C lines check ===\n");

  // The DB quotation's termsAndConditions has 4 lines — verify those are present
  const dbTcLines = [
    "Cutting Charges",
    "Weighing/Loading",
    "Delivery Charges",
    "Testing Charges",
  ];
  for (const tc of dbTcLines) {
    check(`DB T&C: '${tc}' present in PDF`, extractedText.includes(tc));
  }

  // Verify DEFAULT_TERMS in the generator source still has all 9 spec lines
  // (used when termsAndConditions is null/empty)
  const { readFileSync } = require("fs");
  const generatorSrc = readFileSync("lib/generateSukiQuotationPdf.ts", "utf8");
  const defaultTermsMatch = generatorSrc.match(/DEFAULT_TERMS\s*=\s*`([\s\S]*?)`/);
  if (defaultTermsMatch) {
    const defaultTerms = defaultTermsMatch[1];
    const all9SpecLines = [
      "Cutting Charges",
      "Weighing/Loading",
      "Delivery Charges",
      "Testing Charges",
      "Quotation Validity",
      "Taxes",
      "Rejection Clause",
      "Weighment tolerance",
      "Clerical error",
    ];
    for (const tc of all9SpecLines) {
      check(`DEFAULT_TERMS contains '${tc}'`, defaultTerms.includes(tc));
    }
  } else {
    check("DEFAULT_TERMS found in source", false);
  }

  // ── Math verification ──
  console.log("\n=== Math verification ===\n");
  const item = quotation.items[0];
  if (item) {
    const qty = item.quantity;
    const unitPrice = item.unitPrice;
    const discount = item.discountPercent || 0;
    const taxPct = item.taxPercent || 18;
    const taxable = qty * unitPrice * (1 - discount / 100);
    const taxAmount = taxable * (taxPct / 100);
    const cgst = taxAmount / 2;
    const sgst = taxAmount / 2;
    const cutting = item.cuttingCharge || 0;
    const lineTotal = taxable + taxAmount + cutting;

    console.log(`Item: qty=${qty}, unitPrice=${unitPrice}, discount=${discount}%, tax=${taxPct}%`);
    console.log(`  Taxable Val = ${qty} × ${unitPrice} × (1 - ${discount}/100) = ${taxable}`);
    console.log(`  Tax Amount = ${taxable} × ${taxPct}/100 = ${taxAmount}`);
    console.log(`  CGST = ${taxAmount} / 2 = ${cgst}`);
    console.log(`  SGST = ${taxAmount} / 2 = ${sgst}`);
    console.log(`  Cutting = ${cutting}`);
    console.log(`  Line Total = ${taxable} + ${taxAmount} + ${cutting} = ${lineTotal}`);

    check(`Taxable Val computed correctly`, extractedText.includes(formatIndianCurrency(taxable)));
    check(`CGST Val computed correctly (tax/2)`, extractedText.includes(formatIndianCurrency(cgst)));
    check(`SGST Val computed correctly (tax/2)`, extractedText.includes(formatIndianCurrency(sgst)));
  }

  // ── Test 2: Amount In Words ──
  console.log("\n=== Test 2: Amount In Words ===\n");

  // Test with a synthetic quotation that has a grand total in lakhs
  // We'll generate a PDF with known item values to verify Amount In Words
  const testDoc1 = generateSukiQuotationPdf({
    quotationCode: "TEST-WORDS-001",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-14"),
    customer: { name: "Test Customer", customerCode: "TEST-001" },
    contact: { name: "Test Contact", phone: "9999999999" },
    company: { name: "Test Company" },
    items: [{
      description: "Test item",
      quantity: 100,
      unitPrice: 1000,
      taxPercent: 18,
      unit: "Kgs",
    }],
    termsAndConditions: "Test T&C",
    generatedByName: "Test",
  });

  const testText1 = await extractPdfText(testDoc1.output("arraybuffer"));
  // Grand total = 100 * 1000 * 1.18 = 118000 → "One Lakh Eighteen Thousand"
  check(`Amount In Words for ₹1,18,000: contains 'Lakh'`, testText1.includes("Lakh"), testText1.match(/Amount In Words[\s\S]*?Terms/i)?.[0]?.trim());
  check(`Amount In Words for ₹1,18,000: contains 'Eighteen'`, testText1.includes("Eighteen"));

  // Test with a larger amount (crores)
  const testDoc2 = generateSukiQuotationPdf({
    quotationCode: "TEST-WORDS-002",
    revisionNumber: 1,
    status: "Draft",
    validUntil: new Date("2026-12-31"),
    createdAt: new Date("2026-08-14"),
    customer: { name: "Test Customer", customerCode: "TEST-002" },
    contact: { name: "Test Contact", phone: "9999999999" },
    company: { name: "Test Company" },
    items: [{
      description: "Test item large",
      quantity: 1000,
      unitPrice: 100000,
      taxPercent: 18,
      unit: "Kgs",
    }],
    termsAndConditions: "Test T&C",
    generatedByName: "Test",
  });

  const testText2 = await extractPdfText(testDoc2.output("arraybuffer"));
  // Grand total = 1000 * 100000 * 1.18 = 118000000 → "Eleven Crore Eighty Lakh"
  check(`Amount In Words for ₹11,80,00,000: contains 'Crore'`, testText2.includes("Crore"));
  check(`Amount In Words for ₹11,80,00,000: contains 'Eleven'`, testText2.includes("Eleven"));
  check(`Amount In Words for ₹11,80,00,000: contains 'Eighty'`, testText2.includes("Eighty"));
  check(`Amount In Words for ₹11,80,00,000: contains 'Lakh'`, testText2.includes("Lakh"));

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

function formatIndianCurrency(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
