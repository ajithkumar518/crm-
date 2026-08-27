/**
 * Verifies dynamic pagination for the Proforma Invoice PDF and Quotation PDF generators.
 * Tests both a SHORT item list (should stay on 1 page) and a LONG item list (should
 * span multiple pages, with the header/Bill-Ship repeating and "Page X of Y" accurate).
 */
import { generateSukiProformaInvoicePdf, SukiProformaInvoiceData } from "../lib/generateSukiProformaInvoicePdf";
import { generateSukiQuotationPdf, SukiQuotationPdfData } from "../lib/generateSukiQuotationPdf";
import { PDFParse } from "pdf-parse";
import { writeFileSync } from "fs";

function makeProformaItem(i: number) {
  return {
    description: `SAE1018 DIA ${16 + (i % 5)}`,
    hsn: "72141090",
    quantity: 50 + i,
    unit: "Kgs",
    numberOfPieces: 10 + i,
    unitPrice: 75,
    discountPercent: 0,
    taxPercent: 18,
    taxable: (50 + i) * 75,
    cuttingCharge: 0,
  };
}

async function buildProforma(itemCount: number, label: string) {
  const items = Array.from({ length: itemCount }, (_, i) => makeProformaItem(i));
  const totalItemTaxable = items.reduce((s, it) => s + it.taxable, 0);

  const data: SukiProformaInvoiceData = {
    proformaNumber: `PF-2026-TEST-${label}`,
    proformaDate: new Date(),
    customer: {
      name: "ABC Engineering Works",
      billingAddress: "123 Industrial Estate, Chennai",
      shippingAddress: "123 Industrial Estate, Chennai",
      state: "Tamil Nadu",
      gstNumber: "33AAAAA0000A1Z5",
      phone: "9999999999",
    },
    company: {
      name: "Shahnaz Bright Steel Industries Private Limited",
      gstin: "33ABACS6559E1ZD",
    },
    items,
    charges: {
      transportCharge: 100,
      otherCharges: 0,
      weighingLoadingCharge: 50,
      deliveryCharge: 0,
      testingCharge: 0,
    },
    bank: {
      name: "Test Bank",
      ifsc: "TEST0001234",
      accountNo: "1234567890",
      branch: "Chennai Main",
    },
    grandTotal: totalItemTaxable * 1.18 + 150,
    placeOfSupply: "Tamil Nadu",
    billState: "Tamil Nadu",
    shipState: "Tamil Nadu",
  };

  const doc = generateSukiProformaInvoicePdf(data);
  const bytes = doc.output("arraybuffer");
  const outPath = `C:\\Users\\ajithkumar\\Downloads\\test-proforma-${label}.pdf`;
  writeFileSync(outPath, Buffer.from(bytes));

  const parser = new PDFParse({ data: Buffer.from(bytes) });
  const result = await parser.getText();
  const pageCount = result.pages?.length ?? result.total ?? 0;

  console.log(`\n=== Proforma (${itemCount} items) — ${label} ===`);
  console.log(`Saved: ${outPath}`);
  console.log(`Physical pages in PDF: ${pageCount} (x4 copies expected if items span multiple pages per copy)`);
  const text = result.text || "";
  const pageOfMatches = text.match(/Page \d+ of \d+/g) || [];
  console.log(`"Page X of Y" occurrences found: ${pageOfMatches.length}`, pageOfMatches.slice(0, 8));
  console.log(`Contains "Total" row: ${text.includes("Total")}`);
  console.log(`Contains "Invoice No." meta: ${text.includes("Invoice No.")}`);
}

function makeQuotationItem(i: number) {
  return {
    description: `SAE1018 DIA ${16 + (i % 5)}`,
    productType: "Black Bar",
    materialGrade: "SAE1018",
    materialSize: `${16 + (i % 5)}`,
    numberOfPieces: 10 + i,
    quantity: 50 + i,
    unitPrice: 75,
    discountPercent: 0,
    taxPercent: 18,
    hsn: "72141090",
    unit: "Kgs",
    cuttingCharge: 0,
  };
}

async function buildQuotation(itemCount: number, label: string) {
  const items = Array.from({ length: itemCount }, (_, i) => makeQuotationItem(i));

  const data: SukiQuotationPdfData = {
    quotationCode: `QT-2026-TEST-${label}`,
    status: "Draft",
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    customer: {
      name: "ABC Engineering Works",
      customerCode: "CUS-00013",
      billingAddress: "123 Industrial Estate, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
      gstNumber: "33AAAAA0000A1Z5",
      phone: "9999999999",
    },
    items,
    placeOfSupply: "Tamil Nadu",
    shipState: "Tamil Nadu",
    companyGstin: "33ABACS6559E1ZD",
  };

  const doc = generateSukiQuotationPdf(data);
  const bytes = doc.output("arraybuffer");
  const outPath = `C:\\Users\\ajithkumar\\Downloads\\test-quotation-${label}.pdf`;
  writeFileSync(outPath, Buffer.from(bytes));

  const parser = new PDFParse({ data: Buffer.from(bytes) });
  const result = await parser.getText();
  const pageCount = result.pages?.length ?? result.total ?? 0;

  console.log(`\n=== Quotation (${itemCount} items) — ${label} ===`);
  console.log(`Saved: ${outPath}`);
  console.log(`Physical pages in PDF: ${pageCount}`);
  const text = result.text || "";
  const pageOfMatches = text.match(/Page \d+ of \d+/g) || [];
  console.log(`"Page X of Y" occurrences found: ${pageOfMatches.length}`, pageOfMatches.slice(0, 8));
  console.log(`Contains "Total" row: ${text.includes("Total")}`);
}

async function main() {
  await buildProforma(3, "short");
  await buildProforma(25, "long");
  await buildQuotation(3, "short");
  await buildQuotation(25, "long");
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
