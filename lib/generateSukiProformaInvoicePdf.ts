import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import {
  setupPdfFonts,
  setFont,
  formatCurrency,
  formatPdfDate,
  PdfColors,
} from "./pdf-shared";
import { resolveTaxTreatment, computeGstSplit, TaxTreatment, getStateCodeFromName } from "./gstState";

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function toWordsBelowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ones[n];
  if (n < 20) return teens[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
  }
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (r === 0) return `${ones[h]} Hundred`;
  return `${ones[h]} Hundred and ${toWordsBelowThousand(r)}`;
}

function toIndianWords(amount: number): string {
  if (amount === 0) return "Zero";
  const rupees = Math.floor(amount);
  const parts: string[] = [];

  const crore = Math.floor(rupees / 10000000);
  const lakhRemainder = rupees % 10000000;
  const lakh = Math.floor(lakhRemainder / 100000);
  const thousandRemainder = lakhRemainder % 100000;
  const thousand = Math.floor(thousandRemainder / 1000);
  const hundredsRemainder = thousandRemainder % 1000;

  if (crore > 0) parts.push(`${toWordsBelowThousand(crore)} Crore`);
  if (lakh > 0) parts.push(`${toWordsBelowThousand(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${toWordsBelowThousand(thousand)} Thousand`);
  if (hundredsRemainder > 0) parts.push(toWordsBelowThousand(hundredsRemainder));

  return parts.join(" ");
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const rupeeWords = toIndianWords(rupees);
  const paiseWords = toIndianWords(paise);
  let result = `Indian Rupee ${rupeeWords}`;
  if (paise > 0) result += ` & ${paiseWords} Paise`;
  result += " Only";
  return result;
}

export interface SukiProformaInvoiceData {
  proformaNumber: string;
  proformaDate: Date | string | null;
  validityDate?: Date | string | null;
  customer: {
    name: string;
    billingAddress?: string | null;
    shippingAddress?: string | null;
    state?: string | null;
    gstNumber?: string | null;
    phone?: string | null;
  } | null;
  contact?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  company: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    pan?: string | null;
    cin?: string | null;
    regOff?: string | null;
    logoPath?: string | null;
  } | null;
  items: {
    description: string;
    hsn?: string | null;
    quantity: number;
    unit?: string | null;
    numberOfPieces?: number | null;
    unitPrice: number;
    discountPercent?: number | null;
    taxPercent?: number | null;
    taxable: number;
    cuttingCharge?: number | null;
  }[];
  charges: {
    transportCharge: number;
    otherCharges: number;
    weighingLoadingCharge: number;
    deliveryCharge: number;
    testingCharge: number;
  };
  bank: {
    name: string;
    ifsc: string;
    accountNo: string;
    branch: string;
  };
  subtotal?: number;
  taxAmount?: number;
  grandTotal: number;
  roundedOff?: number;
  paymentTerms?: string | null;
  placeOfSupply?: string | null;
  state?: string | null;
  stateCode?: string | null;
  despatchThrough?: string | null;
  vehicleNo?: string | null;
  customerPoNo?: string | null;
  customerPoDate?: Date | string | null;
  ewayBillNo?: string | null;
  ewayBillDate?: Date | string | null;
  irn?: string | null;
  ackNo?: string | null;
  ackDate?: Date | string | null;
  billName?: string | null;
  billAddress?: string | null;
  billState?: string | null;
  billStateCode?: string | null;
  billGstNumber?: string | null;
  billPhone?: string | null;
  shipName?: string | null;
  shipAddress?: string | null;
  shipState?: string | null;
  shipStateCode?: string | null;
  shipGstNumber?: string | null;
  shipPhone?: string | null;
  preparedBy?: string | null;
  verifiedBy?: string | null;
  declaration?: string | null;
  termsAndConditions?: string | null;
}

const DEFAULT_DECLARATION = `Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and that there s no flow additional consideration directly or indirectly from the buyer.`;

const DEFAULT_TERMS = `1.All reports shortage must reach within 3 days and about defective supply if any within 10 days from date of delivery in writing no claim will be acceptable by us thereafter.
2.Rejection of material will be acceptable only in original shape of out supply )not after machining & cutting hardening)
3.All disputes are subject to Chennai Jurisdiction only.
4.Interest @24% will be charged on all over due bills.`;

export function generateSukiProformaInvoicePdf(data: SukiProformaInvoiceData, opts?: { copies?: string[] }): jsPDF {
  const copies = opts?.copies ?? [
    "ORIGINAL FOR RECIPIENT",
    "DUPLICATE FOR TRANSPORTER",
    "TRIPLICATE FOR SUPPLIER",
    "EXTRA COPY",
  ];

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupPdfFonts(doc);

  const margin = 8;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const computed = computeTotals(data);

  for (let i = 0; i < copies.length; i++) {
    if (i > 0) doc.addPage();
    const pagesBeforeCopy = doc.getNumberOfPages();

    drawPage(doc, data, computed, copies[i], margin);

    const pagesAfterCopy = doc.getNumberOfPages();
    const totalPagesInCopy = pagesAfterCopy - pagesBeforeCopy + 1;

    // Second pass: write accurate "Page X of Y" now that we know the real
    // page count for this copy (each copy paginates independently).
    for (let p = pagesBeforeCopy; p <= pagesAfterCopy; p++) {
      doc.setPage(p);
      const pageWithinCopy = p - pagesBeforeCopy + 1;
      drawFooterPageNumber(doc, pageWithinCopy, totalPagesInCopy, margin, pageW, pageH);
    }
  }

  return doc;
}

function computeTotals(data: SukiProformaInvoiceData) {
  // Determine GST tax treatment: compare Supplier State vs Place of Supply
  const gstResult = resolveTaxTreatment(
    data.company?.gstin,
    data.placeOfSupply,
    data.shipGstNumber,
    data.shipState,
    data.billGstNumber,
    data.billState,
  );
  const isUnknown = gstResult.treatment === "unknown";
  const treatment = isUnknown ? "intra_state" : gstResult.treatment;
  const isInterState = treatment === "inter_state";

  // Default to intra-state (CGST+SGST) if tax type cannot be determined and show a warning.

  const totalItemTaxable = data.items.reduce((s, it) => s + it.taxable, 0);
  const totalQty = data.items.reduce((s, it) => s + it.quantity, 0);
  const totalPcs = data.items.reduce((s, it) => s + (it.numberOfPieces || 0), 0);

  // HSN map: accumulate taxable per HSN, compute CGST/SGST/IGST independently
  const hsnMap = new Map<string, { taxable: number; taxPercent: number; cgst: number; sgst: number; igst: number; tax: number }>();
  for (const it of data.items) {
    const hsn = it.hsn || "—";
    const taxPct = it.taxPercent || 18;
    const { cgst, sgst, igst, totalTax } = computeGstSplit(it.taxable, taxPct, treatment);
    const existing = hsnMap.get(hsn);
    if (existing) {
      existing.taxable += it.taxable;
      existing.cgst += cgst;
      existing.sgst += sgst;
      existing.igst += igst;
      existing.tax += totalTax;
    } else {
      hsnMap.set(hsn, { taxable: it.taxable, taxPercent: taxPct, cgst, sgst, igst, tax: totalTax });
    }
  }

  const hsnRows: { hsn: string; taxable: number; taxPercent: number; cgst: number; sgst: number; igst: number; tax: number }[] = [];
  let totalHsnTaxable = 0;
  let totalHsnTax = 0;
  let totalHsnCgst = 0;
  let totalHsnSgst = 0;
  let totalHsnIgst = 0;
  for (const [hsn, row] of hsnMap) {
    hsnRows.push({ hsn, taxable: row.taxable, taxPercent: row.taxPercent, cgst: row.cgst, sgst: row.sgst, igst: row.igst, tax: row.tax });
    totalHsnTaxable += row.taxable;
    totalHsnTax += row.tax;
    totalHsnCgst += row.cgst;
    totalHsnSgst += row.sgst;
    totalHsnIgst += row.igst;
  }

  const serviceTaxable =
    data.charges.transportCharge +
    data.charges.otherCharges +
    data.charges.weighingLoadingCharge +
    data.charges.deliveryCharge +
    data.charges.testingCharge;

  const serviceTaxPercent = 18;
  const serviceTax = serviceTaxable * (serviceTaxPercent / 100);

  if (serviceTaxable > 0) {
    // UI does not apply tax to extra charges; do not add 996111 row or increment totalHsnTax
  }

  const rawTotal = totalItemTaxable + serviceTaxable + totalHsnTax;
  const rounded = data.roundedOff ?? Math.round(rawTotal * 100) / 100 - rawTotal;

  return {
    totalItemTaxable,
    totalQty,
    totalPcs,
    hsnRows,
    totalHsnTaxable,
    totalHsnTax,
    totalHsnCgst,
    totalHsnSgst,
    totalHsnIgst,
    serviceTaxable,
    serviceTax,
    rawTotal,
    roundedOff: rounded,
    treatment,
    isInterState,
    gstResult,
  };
}

/** Draws the fixed decorative border around the full page content area. */
function drawPageBorder(doc: jsPDF, margin: number, pageW: number, pageH: number, contentW: number): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(margin, margin, contentW, pageH - 2 * margin);
}

/** Static footer text that doesn't depend on the final page count (drawn on every page immediately). */
function drawFooterStatic(doc: jsPDF, margin: number, pageW: number, pageH: number): void {
  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("This is a Computer Generated Invoice", pageW / 2, pageH - margin + 3.5, { align: "center" });

  const footerY = pageH - margin + 7;
  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("Ref: SUKI-PF-01", margin + 2, footerY, { align: "left" });
  doc.text("Shahnaz CRM", pageW / 2, footerY, { align: "center" });
}

/** "Page X of Y" — written in a second pass once the true page count for the copy is known. */
function drawFooterPageNumber(doc: jsPDF, pageNum: number, totalPages: number, margin: number, pageW: number, pageH: number): void {
  const footerY = pageH - margin + 7;
  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin - 2, footerY, { align: "right" });
}

/**
 * Draws the full repeatable header block: copy label, title, company banner/details,
 * invoice meta (No./Date), and Bill To/Ship To panels. Used on page 1 and re-drawn
 * identically on any continuation page so the header always repeats, matching the
 * reference multi-page layout.
 */
function drawHeaderBlock(doc: jsPDF, data: SukiProformaInvoiceData, copyType: string, margin: number, pageW: number, contentW: number): number {
  let y = margin;

  // Copy label
  doc.setFontSize(9);
  setFont(doc, "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(copyType, pageW - margin - 2, y + 4, { align: "right" });

  // Title
  doc.setFontSize(14);
  setFont(doc, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("PRO-FORMA INVOICE", pageW / 2, y + 4, { align: "center" });
  y += 7;

  // Horizontal line above company name
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Company banner
  doc.setFontSize(13);
  setFont(doc, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(data.company?.name || "Shahnaz Bright Steel Industries Private Limited", pageW / 2, y, { align: "center" });
  y += 3;

  // Horizontal line below company name
  doc.line(margin, y, pageW - margin, y);
  y += 3;

  // Company details block
  const logoW = 40;
  const logoH = 18;

  // Left: logo
  try {
    const logoPath = data.company?.logoPath || path.join(process.cwd(), "public", "shahnaz-logo.png");
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath).toString("base64");
      doc.addImage(`data:image/png;base64,${logoData}`, "PNG", margin + 4, y, logoW, logoH);
    } else {
      doc.setFillColor(...PdfColors.primary);
      doc.rect(margin + 4, y, logoW, logoH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      setFont(doc, "bold");
      doc.text("SBS", margin + 8, y + 10);
    }
  } catch {
    // ignore
  }

  // Right: company address
  const rightX = margin + logoW + 10;
  const availWidth = contentW - logoW - 12;
  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(0, 0, 0);

  const compAddr = data.company?.address || "No:1,Plot No.52A,52B,No.102,Mugappair Road\nPadi,Chennai,Tamil Nadu - 600050 , India";
  const compPhone = data.company?.phone || "9363331766, 7845517678";
  const compRegOff = data.company?.regOff || "No.327/17A,17B,18,325/2A,2B,3,Kuthiraipallam Village,\nJaganathapuram Post,Ponneri,Tiruvallur Dist,Chennai-600067";
  const compPan = data.company?.pan || "ABACS6559E";
  const compGstin = data.company?.gstin || "33ABACS6559E1ZD";
  const compCin = data.company?.cin || "U28999TN2018PTC123999";

  const companyLines = [
    ...compAddr.split("\n"),
    `Phone : ${compPhone}`,
    ...(`Reg Off : ${compRegOff}`.split("\n")),
    [`PAN : ${compPan}`, `GSTIN : ${compGstin}`].filter(Boolean).join(",  "),
    `CIN : ${compCin}`
  ].filter(Boolean);

  let cy = y + 1.5;
  for (const line of companyLines) {
    if (!line) continue;
    const wrapped = doc.splitTextToSize(line, availWidth);
    doc.text(wrapped, rightX, cy, { align: "left" });
    cy += wrapped.length * 3.5 + 0.5;
  }
  y = Math.max(y + logoH + 2, cy + 0.5);

  // Invoice No. / Invoice Date meta line — this IS the app's internal Proforma Number
  // (e.g. PF-2026-00004), the same identifier used in the Proforma Overview list/URL.
  y = drawInvoiceMeta(doc, data, margin, y, contentW);

  // Customer blocks (Bill To / Ship To)
  y = drawCustomerBlocks(doc, data, margin, y, contentW);

  return y;
}

/** Slim invoice meta line: Invoice No. (= Proforma Number), Invoice Date, and Payment Terms. */
function drawInvoiceMeta(doc: jsPDF, data: SukiProformaInvoiceData, x: number, y: number, w: number): number {
  const lineH = 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  const ly = y + 4;
  const col1 = x + 2;
  const col2 = x + w * 0.37;
  const col3 = x + w * 0.68;

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Invoice No.", col1, ly);
  doc.text("Invoice Date", col2, ly);
  doc.text("Payment Terms", col3, ly);

  setFont(doc, "normal");
  doc.text(`: ${data.proformaNumber || ""}`, col1 + 22, ly);
  doc.text(`: ${data.proformaDate ? formatPdfDate(data.proformaDate) : ""}`, col2 + 22, ly);
  doc.text(`: ${data.paymentTerms || ""}`, col3 + 26, ly);

  const h = lineH + 2;
  doc.rect(x, y, w, h);

  return y + h + 2;
}

function drawCustomerBlocks(doc: jsPDF, data: SukiProformaInvoiceData, x: number, y: number, w: number): number {
  const halfW = (w - 4) / 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  const customer = data.customer;
  const billName = data.billName || customer?.name || "—";
  const billAddress = data.billAddress || customer?.billingAddress || "";
  const billState = data.billState || customer?.state || "";
  const billGst = data.billGstNumber || customer?.gstNumber || "";
  const billPhone = data.billPhone || customer?.phone || "";

  const shipName = data.shipName || customer?.name || "—";
  const shipAddress = data.shipAddress || customer?.shippingAddress || customer?.billingAddress || "";
  const shipState = data.shipState || customer?.state || "";
  const shipGst = data.shipGstNumber || customer?.gstNumber || "";
  const shipPhone = data.shipPhone || customer?.phone || "";

  const blocks = [
    { title: "Details of Customer (Bill To)", name: billName, address: billAddress, state: billState, gst: billGst, phone: billPhone, x: x + 2, stateCode: data.billStateCode || getStateCodeFromName(billState) },
    { title: "Details of Customer (Ship To)", name: shipName, address: shipAddress, state: shipState, gst: shipGst, phone: shipPhone, x: x + halfW + 4, stateCode: data.shipStateCode || getStateCodeFromName(shipState) },
  ];

  let blockEndY = y;
  for (const b of blocks) {
    let by = y + 5;
    doc.setFontSize(8);
    setFont(doc, "bold");
    doc.text(b.title, b.x, by);
    by += 5;

    const labelW = 30;
    const lines = [
      ["Name", b.name || "—"],
      ["Address", b.address || "—"],
      ["State", b.state || "—"],
      ["GST No", b.gst || "—"],
      ["Phone No", b.phone || "—"],
    ];

    for (const [label, value] of lines) {
      doc.setFontSize(8);
      setFont(doc, "bold");
      doc.text(`${label} :`, b.x, by);

      if (label === "Name") {
        // Name value emphasized in bold
        setFont(doc, "bold");
        const wrapped = doc.splitTextToSize(value || "—", halfW - labelW - 8);
        doc.text(wrapped, b.x + labelW, by);
        by += Math.max(3.0, wrapped.length * 3.0);
      } else if (label === "State" && b.state) {
        // State name normal, "State Code" label bold, code value normal
        setFont(doc, "normal");
        const statePrefix = `${b.state}  `;
        doc.text(statePrefix, b.x + labelW, by);
        let cursorX = b.x + labelW + doc.getTextWidth(statePrefix);

        setFont(doc, "bold");
        const stateCodeLabel = "State Code : ";
        doc.text(stateCodeLabel, cursorX, by);
        cursorX += doc.getTextWidth(stateCodeLabel);

        setFont(doc, "normal");
        doc.text(b.stateCode || "—", cursorX, by);
        by += 3.0;
      } else {
        setFont(doc, "normal");
        const wrapped = doc.splitTextToSize(value || "—", halfW - labelW - 8);
        doc.text(wrapped, b.x + labelW, by);
        by += Math.max(3.0, wrapped.length * 3.0);
      }
    }
    blockEndY = Math.max(blockEndY, by);
  }

  const h = blockEndY - y + 4;
  doc.rect(x, y, w, h);
  doc.line(x + halfW + 2, y, x + halfW + 2, y + h);

  return y + h + 2;
}

function buildItemsTableHead(): string[][] {
  return [["S.No", "Description of Goods", "Length", "HSN", "Qty", "UOM", "No.of Pcs", "Rate", "Taxable Value"]];
}

function buildItemsTableBody(data: SukiProformaInvoiceData, c: ReturnType<typeof computeTotals>): (string | number)[][] {
  const body = data.items.map((it, idx) => {
    const pieceUnit = it.unit === "Bundles" || it.unit === "Bundle" ? "Bundles" : "Nos";
    const lengthText = `${it.numberOfPieces ?? ""} ${pieceUnit === "Bundles" ? "BUNDLES" : "LENGTH"}`;
    const noOfPcs = `${it.numberOfPieces ?? ""} ${pieceUnit}`;
    return [
      String(idx + 1).padStart(2, "0"),
      it.description || "—",
      lengthText,
      it.hsn || "—",
      it.quantity.toFixed(3),
      it.unit || "Kgs",
      noOfPcs,
      formatCurrency(it.unitPrice),
      formatCurrency(it.taxable),
    ];
  });

  body.push([
    "",
    "Total",
    "",
    "",
    c.totalQty.toFixed(3),
    "",
    c.totalPcs ? `${c.totalPcs} Nos` : "",
    "",
    formatCurrency(c.totalItemTaxable),
  ]);

  return body;
}

/**
 * Measures the height the HSN summary + bank/charges + amount-in-words + terms/declaration
 * block would need, by actually drawing them once onto a throwaway scratch page (using the
 * exact same draw functions used for the real render) and reading back the resulting Y.
 * This avoids brittle height heuristics — the measurement is byte-for-byte what will really
 * be drawn later.
 */
function measureSummaryBlockHeight(doc: jsPDF, data: SukiProformaInvoiceData, c: ReturnType<typeof computeTotals>, contentW: number): number {
  const activePage = doc.getCurrentPageInfo().pageNumber;

  doc.addPage();
  const scratchPage = doc.getNumberOfPages();

  const startY = 10;
  let y = drawHsnTable(doc, data, c, 0, startY, contentW);
  y = drawBankAndCharges(doc, data, c, 0, y, contentW);

  y += 2;
  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Amount In Words", 0, y);
  y += 4;
  setFont(doc, "normal");
  const words = doc.splitTextToSize(amountInWords(data.grandTotal), contentW - 6);
  doc.text(words, 0, y);
  y += words.length * 3.5 + 2;

  y = drawTermsAndDeclaration(doc, data, 0, y, contentW);

  const measuredHeight = y - startY;

  doc.deletePage(scratchPage);
  doc.setPage(activePage);

  const signatureReserve = 18;
  return measuredHeight + signatureReserve;
}

function drawPage(doc: jsPDF, data: SukiProformaInvoiceData, c: ReturnType<typeof computeTotals>, copyType: string, margin: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - 2 * margin;

  drawPageBorder(doc, margin, pageW, pageH, contentW);
  const headerEndY = drawHeaderBlock(doc, data, copyType, margin, pageW, contentW);
  drawFooterStatic(doc, margin, pageW, pageH);

  const headerBlockHeight = headerEndY - margin;
  const footerReserve = 12;

  const head = buildItemsTableHead();
  const body = buildItemsTableBody(data, c);

  autoTable(doc, {
    startY: headerEndY,
    margin: { left: margin, right: margin, top: margin + headerBlockHeight, bottom: margin + footerReserve },
    head,
    body,
    styles: {
      font: "NotoSans",
      fontSize: 8,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: 30,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: 0,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center" },
      1: { halign: "left" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "right" },
      5: { halign: "center" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
    didDrawCell: (p) => {
      if (p.row.index === body.length - 1) {
        doc.setFont("NotoSans", "bold");
      }
    },
    didDrawPage: (hookData) => {
      // Repeat the border + full header (company info + Bill To/Ship To) on every
      // continuation page the items table spills onto, matching the reference layout.
      if (hookData.pageNumber > 1) {
        drawPageBorder(doc, margin, pageW, pageH, contentW);
        drawHeaderBlock(doc, data, copyType, margin, pageW, contentW);
        drawFooterStatic(doc, margin, pageW, pageH);
      }
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 2;

  // Decide whether the HSN/bank/terms/signature block fits on the current page,
  // or needs to start fresh on a new page (matching the reference's page-2 layout).
  const requiredHeight = measureSummaryBlockHeight(doc, data, c, contentW);
  const availableSpace = pageH - margin - footerReserve - y;

  if (availableSpace < requiredHeight) {
    doc.addPage();
    drawPageBorder(doc, margin, pageW, pageH, contentW);
    y = drawHeaderBlock(doc, data, copyType, margin, pageW, contentW);
    drawFooterStatic(doc, margin, pageW, pageH);
  }

  // HSN table
  y = drawHsnTable(doc, data, c, margin, y, contentW);

  // Bank + charges summary
  y = drawBankAndCharges(doc, data, c, margin, y, contentW);

  // Amount in words
  y += 2;
  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Amount In Words", margin + 3, y);
  y += 4;
  setFont(doc, "normal");
  const words = doc.splitTextToSize(amountInWords(data.grandTotal), contentW - 6);
  doc.text(words, margin + 3, y);
  y += words.length * 3.5 + 2;

  // Terms & Conditions
  y = drawTermsAndDeclaration(doc, data, margin, y, contentW);

  // Signature block pinned to the bottom of the page
  const signatureH = 12;
  const signatureY = pageH - margin - signatureH - 3;
  drawSignatureBlock(doc, data, margin, signatureY, contentW);
}

function drawHsnTable(doc: jsPDF, data: SukiProformaInvoiceData, c: ReturnType<typeof computeTotals>, x: number, y: number, w: number): number {
  const isInterState = c.isInterState;

  const head = isInterState
    ? [["HSN Code", "Taxable Value", "IGST %", "IGST Amt", "Total Tax"]]
    : [["HSN Code", "Taxable Value", "CGST %", "CGST Amt", "SGST %", "SGST Amt", "Total Tax"]];

  const body = isInterState
    ? c.hsnRows.map((r) => [
        r.hsn,
        formatCurrency(r.taxable),
        `${r.taxPercent}%`,
        formatCurrency(r.igst),
        formatCurrency(r.tax),
      ])
    : c.hsnRows.map((r) => [
        r.hsn,
        formatCurrency(r.taxable),
        `${r.taxPercent / 2}%`,
        formatCurrency(r.cgst),
        `${r.taxPercent / 2}%`,
        formatCurrency(r.sgst),
        formatCurrency(r.tax),
      ]);

  if (isInterState) {
    body.push(["Total", formatCurrency(c.totalHsnTaxable), "", formatCurrency(c.totalHsnIgst), formatCurrency(c.totalHsnTax)]);
  } else {
    body.push(["Total", formatCurrency(c.totalHsnTaxable), "", formatCurrency(c.totalHsnCgst), "", formatCurrency(c.totalHsnSgst), formatCurrency(c.totalHsnTax)]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: x, right: x },
    tableWidth: w,
    head,
    body,
    styles: {
      font: "NotoSans",
      fontSize: 8,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: 30,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: 0,
      fontStyle: "bold",
    },
    columnStyles: isInterState
      ? {
          0: { halign: "left" },
          1: { halign: "right" },
          2: { halign: "center" },
          3: { halign: "right" },
          4: { halign: "right" },
        }
      : {
          0: { halign: "left" },
          1: { halign: "right" },
          2: { halign: "center" },
          3: { halign: "right" },
          4: { halign: "center" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
    didDrawCell: (p) => {
      if (p.row.index === body.length - 1) {
        doc.setFont("NotoSans", "bold");
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 2;
}

function drawBankAndCharges(doc: jsPDF, data: SukiProformaInvoiceData, c: ReturnType<typeof computeTotals>, x: number, y: number, w: number): number {
  const split = w * 0.45;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  // Left: bank
  let by = y + 5;
  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Our Bank Details", x + 3, by);
  by += 5;

  const bankRows = [
    ["Bank Name", data.bank.name],
    ["IFSC Code", data.bank.ifsc],
    ["A/c No", data.bank.accountNo],
    ["Branch", data.bank.branch],
  ];
  for (const [label, value] of bankRows) {
    doc.setFontSize(8);
    setFont(doc, "bold");
    doc.text(`${label} :`, x + 3, by);
    setFont(doc, "normal");
    doc.text(value, x + 28, by);
    by += 3.5;
  }

  // Right: charges summary
  const rightX = x + split + 3;
  const rightValX = x + w - 3;
  let ry = y + 5;

  const chargeRows: [string, number][] = [
    ["Item Value", c.totalItemTaxable],
    ["Loading / Weighing Charges (Before Tax)", data.charges.weighingLoadingCharge],
    ["Cutting Charges (Before Tax)", data.charges.transportCharge],
    ["Delivery Charges (Before Tax)", data.charges.deliveryCharge],
    ["Testing Charges (Before Tax)", data.charges.testingCharge],
    ["Other Charges (Before Tax)", data.charges.otherCharges],
    ...(c.isInterState
      ? [["Add : IGST", c.totalHsnIgst] as [string, number]]
      : [["Add : CGST", c.totalHsnCgst] as [string, number], ["Add : SGST", c.totalHsnSgst] as [string, number]]),
    ["Rounded Off(+/-)", c.roundedOff],
    ["Total Amount", data.grandTotal],
  ];

  for (let i = 0; i < chargeRows.length; i++) {
    const [label, value] = chargeRows[i];
    if (i > 0 && i < chargeRows.length - 2 && value === 0) continue; // skip zero charge rows except main rows
    doc.setFontSize(8);
    setFont(doc, i === chargeRows.length - 1 ? "bold" : "normal");
    doc.text(label, rightX, ry);
    doc.text(formatCurrency(value), rightValX, ry, { align: "right" });
    if (i < chargeRows.length - 1) {
      doc.setDrawColor(180, 180, 180);
      doc.line(rightX, ry + 1, x + w - 3, ry + 1);
    }
    ry += 3.5;
  }

  const h = Math.max(by, ry) - y + 4;
  doc.rect(x, y, w, h);
  doc.line(x + split, y, x + split, y + h);

  return y + h + 2;
}

function drawTermsAndDeclaration(doc: jsPDF, data: SukiProformaInvoiceData, x: number, y: number, w: number): number {
  const terms = data.termsAndConditions || DEFAULT_TERMS;
  const declaration = data.declaration || DEFAULT_DECLARATION;

  const labelCol = 45;
  const textX = x + labelCol;
  const textW = w - labelCol - 4;
  const termsLines = doc.splitTextToSize(terms, textW);
  const declLines = doc.splitTextToSize(declaration, textW);
  const lineH = 3.2;
  const termsH = 4 + termsLines.length * lineH;
  const declY = y + 4 + termsH;
  const declH = 4 + declLines.length * lineH;
  const h = Math.max(termsH, 18) + declH + 6;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Terms & Conditions :", x + 3, y + 5);

  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.text(termsLines, textX, y + 5);

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Declaration :", x + 3, declY);

  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.text(declLines, textX, declY);

  return y + h + 2;
}

function drawSignatureBlock(doc: jsPDF, data: SukiProformaInvoiceData, x: number, y: number, w: number): number {
  const h = 12; // Reduced from 20 to remove dead space
  const col1 = w * 0.30;
  const col2 = w * 0.30;
  const col3 = w * 0.40;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.line(x + col1, y, x + col1, y + h);
  doc.line(x + col1 + col2, y, x + col1 + col2, y + h);

  // Top Labels
  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Prepared By", x + 3, y + 4);
  doc.text("Verified By", x + col1 + 3, y + 4);

  const authX = x + col1 + col2 + 3;
  const companyName = data.company?.name || "Shahnaz Bright Steel Industries Private Limited";
  const forLines = doc.splitTextToSize(`For ${companyName}`, col3 - 6);
  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text(forLines, authX, y + 4);

  // Bottom Values / Signatory Label
  if (data.preparedBy) {
    doc.setFontSize(8);
    setFont(doc, "normal");
    doc.text(data.preparedBy, x + 3, y + 10);
  }

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Authorised Signatory", x + w - 3, y + 10, { align: "right" });

  return y + h;
}
