/**
 * Check what PF-2026-00007 currently shows for tax type.
 * Traces the full resolveTaxTreatment → computeGstSplit → PDF path.
 */
import { prisma } from "../lib/prisma";
import { resolveTaxTreatment, computeGstSplit, getStateCodeFromGstin } from "../lib/gstState";
import { generateSukiProformaInvoicePdf } from "../lib/generateSukiProformaInvoicePdf";
import { PDFParse } from "pdf-parse";

async function extractPdfText(pdfBytes: ArrayBuffer): Promise<string> {
  const uint8 = new Uint8Array(pdfBytes);
  const parser = new PDFParse(uint8);
  const result = await parser.getText();
  return (result as any).text || "";
}

async function main() {
  const p = await prisma.proformaInvoice.findFirst({
    where: { proformaNumber: "PF-2026-00007" },
    include: {
      customer: { select: { name: true, state: true, gstNumber: true, customerCode: true } },
      items: true,
      company: { select: { name: true } },
    },
  });

  if (!p) {
    console.log("PF-2026-00007 not found");
    return;
  }

  console.log("=".repeat(80));
  console.log("PF-2026-00007 — Current Tax Type Analysis");
  console.log("=".repeat(80));
  console.log(`Customer: ${p.customer?.name}`);
  console.log(`Status:   ${p.status}`);
  console.log();

  console.log("STATE FIELDS (all):");
  console.log(`  placeOfSupply:  ${JSON.stringify(p.placeOfSupply)}`);
  console.log(`  shipState:      ${JSON.stringify(p.shipState)}`);
  console.log(`  shipGstNumber:  ${JSON.stringify(p.shipGstNumber)}`);
  console.log(`  billState:      ${JSON.stringify(p.billState)}`);
  console.log(`  billGstNumber:  ${JSON.stringify(p.billGstNumber)}`);
  console.log(`  customer.state: ${JSON.stringify(p.customer?.state)}`);
  console.log(`  customer.gst:   ${JSON.stringify(p.customer?.gstNumber)}`);
  console.log();

  // Get company GSTIN
  const gstinConfig = await prisma.systemConfig.findUnique({ where: { key: "company_gstin" } });
  const companyGstin = gstinConfig?.value || null;
  console.log(`Company GSTIN: ${companyGstin}`);
  console.log(`Supplier State Code: ${getStateCodeFromGstin(companyGstin)}`);
  console.log();

  // Trace resolveTaxTreatment
  console.log("─".repeat(80));
  console.log("resolveTaxTreatment() trace:");
  const result = resolveTaxTreatment(
    companyGstin,
    p.placeOfSupply,
    p.shipGstNumber,
    p.shipState,
    p.billGstNumber || p.customer?.gstNumber,
    p.billState || p.customer?.state,
  );
  console.log(`  treatment:            ${result.treatment}`);
  console.log(`  supplierStateCode:    ${result.supplierStateCode}`);
  console.log(`  placeOfSupplyStateCode: ${result.placeOfSupplyStateCode}`);
  console.log(`  warning:              ${result.warning}`);
  console.log(`  stateFieldMismatch:   ${result.stateFieldMismatch}`);
  console.log();

  // Trace computeGstSplit with the actual treatment
  console.log("─".repeat(80));
  console.log("computeGstSplit() trace (using first item's taxable value):");
  const firstItem = p.items[0];
  if (firstItem) {
    const taxable = firstItem.quantity * firstItem.unitPrice * (1 - (firstItem.discountPercent || 0) / 100);
    const taxPct = firstItem.taxPercent || 18;
    console.log(`  Item: ${firstItem.description}`);
    console.log(`  Taxable: ${taxable}, Tax%: ${taxPct}`);
    console.log(`  Treatment passed: ${result.treatment}`);

    const split = computeGstSplit(taxable, taxPct, result.treatment);
    console.log(`  RESULT: cgst=${split.cgst}, sgst=${split.sgst}, igst=${split.igst}, totalTax=${split.totalTax}`);
    console.log();

    if (result.treatment === "unknown") {
      console.log("  ⚠ BUG CONFIRMED: treatment is 'unknown' but computeGstSplit silently");
      console.log("    returned CGST+SGST values instead of blocking or returning zeros.");
      console.log(`    This document currently shows CGST=${split.cgst} + SGST=${split.sgst} on its PDF,`);
      console.log("    even though NO state data exists to determine the correct tax type.");
    }
  }

  // Generate the actual PDF and check what it shows
  console.log();
  console.log("─".repeat(80));
  console.log("Actual PDF output check:");

  const items = p.items.map((it) => {
    const taxable = it.quantity * it.unitPrice * (1 - (it.discountPercent || 0) / 100);
    return {
      description: it.description || "—",
      hsn: it.hsn || "",
      quantity: it.quantity,
      unit: it.unit || "Kgs",
      numberOfPieces: it.numberOfPieces ?? it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
      taxable,
    };
  });

  try {
    const doc = generateSukiProformaInvoicePdf({
      proformaNumber: p.proformaNumber,
      proformaDate: p.proformaDate,
      validityDate: p.validityDate,
      customer: p.customer,
      contact: null,
      company: {
        name: "Shahnaz Bright Steel Industries Private Limited",
        gstin: companyGstin || "",
      },
      items,
      charges: {
        transportCharge: p.transportCharge,
        otherCharges: p.otherCharges,
        weighingLoadingCharge: p.weighingLoadingCharge,
        deliveryCharge: p.deliveryCharge,
        testingCharge: p.testingCharge,
      },
      bank: { name: "", ifsc: "", accountNo: "", branch: "" },
      subtotal: p.subtotal,
      taxAmount: p.taxAmount,
      grandTotal: p.grandTotal,
      roundedOff: p.roundedOff,
      placeOfSupply: p.placeOfSupply || undefined,
      state: p.shipState || p.billState || p.customer?.state || undefined,
      billState: p.billState || undefined,
      billGstNumber: p.billGstNumber || undefined,
      shipState: p.shipState || undefined,
      shipGstNumber: p.shipGstNumber || undefined,
    });

    const text = await extractPdfText(doc.output("arraybuffer"));

    console.log(`  PDF contains 'CGST': ${text.includes("CGST")}`);
    console.log(`  PDF contains 'SGST': ${text.includes("SGST")}`);
    console.log(`  PDF contains 'IGST': ${text.includes("IGST")}`);
    console.log(`  PDF contains 'Add : CGST': ${text.includes("Add : CGST")}`);
    console.log(`  PDF contains 'Add : SGST': ${text.includes("Add : SGST")}`);
    console.log(`  PDF contains 'Add : IGST': ${text.includes("Add : IGST")}`);
    console.log();

    // Show HSN table excerpt
    const hsnIdx = text.indexOf("HSN");
    if (hsnIdx >= 0) {
      console.log("  HSN table excerpt:");
      console.log("  " + text.substring(hsnIdx, hsnIdx + 300).replace(/\n/g, "\n  "));
    }
  } catch (err) {
    console.log(`  PDF generation error: ${err}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
