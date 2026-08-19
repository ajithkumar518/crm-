import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import {
  setupPdfFonts,
  setFont,
  formatCurrency,
  formatPdfDate,
  addPageFooter,
  PdfColors,
} from "./pdf-shared";
import { resolveTaxTreatment } from "./gstState";

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

export interface ProformaPdfData {
  proformaNumber: string;
  proformaDate: Date | string;
  validityDate: Date | string | null;
  status: string;
  customer?: {
    name: string;
    customerCode?: string | null;
    billingAddress?: string | null;
    city?: string | null;
    state?: string | null;
    gstNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    shippingAddress?: string | null;
  } | null;
  contact?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  company?: { name: string } | null;
  quotationCode?: string | null;
  items: {
    description: string;
    productType?: string | null;
    materialGrade?: string | null;
    materialSize?: string | null;
    lengthMm?: number | null;
    numberOfPieces?: number | null;
    quantity: number;
    unit?: string | null;
    unitPrice: number;
    discountPercent?: number | null;
    taxPercent?: number | null;
    rmMake?: string | null;
    cuttingCharge?: number | null;
    deliveryDays?: number | null;
    remarks?: string | null;
  }[];
  subtotal: number;
  taxAmount: number;
  discountPercent: number;
  grandTotal: number;
  transportCharge?: number | null;
  otherCharges?: number | null;
  weighingLoadingCharge?: number | null;
  deliveryCharge?: number | null;
  testingCharge?: number | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  termsAndConditions?: string | null;
  notes?: string | null;
  companyAddress?: string;
  companyGstin?: string;
  companyPhone?: string;
  companyEmail?: string;
  generatedByName?: string;
}

const DEFAULT_TERMS = `Cutting Charges - Extra
Weighing/Loading - Rs. 350/- PER TON
Delivery Charges - Extra
Testing Charges - Extra
Quotation Validity - Immediate
Taxes - Extra
Rejection Clause - Material will be accepted in supplied condition only.
Weighment tolerance variation plus or minus 5 kgs per MT.
Note: Clerical error if any is subject to correction.`;

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number, title: string, lines: string[]): number {
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "FD");

  doc.setFontSize(9);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.primary);
  doc.text(title, x + 3, y + 5);

  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(30, 30, 30);
  let cy = y + 9;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, w - 6);
    for (const wl of wrapped) {
      doc.text(wl, x + 3, cy);
      cy += 3.6;
    }
  }
  return y + h;
}

export function generateProformaPdf(data: ProformaPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  setupPdfFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - 2 * margin;

  const companyName = "SHAHNAZ BRIGHT STEEL INDUSTRIES PRIVATE LIMITED";

  const headerH = 45;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, margin, contentW, headerH);

  // Left: logo image + company
  const logoWidth = 38;
  const logoHeight = 24;
  const textX = margin + logoWidth + 8;
  try {
    const logoPath = path.join(process.cwd(), "public", "shahnaz-logo.png");
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath).toString("base64");
      doc.addImage(`data:image/png;base64,${logoData}`, "PNG", margin + 2, margin + 3, logoWidth, logoHeight);
    }
  } catch {
    // Fallback placeholder if logo fails to load
    doc.setFillColor(...PdfColors.primary);
    doc.rect(margin + 2, margin + 2, 18, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    setFont(doc, "bold");
    doc.text("SBS", margin + 4, margin + 12);
  }

  // Company name (bold, large)
  doc.setTextColor(...PdfColors.primary);
  doc.setFontSize(14);
  setFont(doc, "bold");
  doc.text(companyName, textX, margin + 8);

  // Address and contact details (black, smaller)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8.5);
  setFont(doc, "normal");
  const companyDetails = [
    "SHAHNAZ BRIGHT STEEL INDUSTRIES PRIVATE LIMITED PLANT 2",
    "No:1, Plot No.52A, 52B, No.102, Mugappair Road",
    "Padi, Chennai",
    "Tamil nadu, Pincode : 600050, India",
    "Phone : 9363331766, 7845517678",
    "sales@saajsteel.com, quotation@saajsteel.com",
  ];
  let ay = margin + 13;
  for (const line of companyDetails) {
    if (ay < margin + headerH - 4) {
      doc.text(line, textX, ay);
      ay += 4;
    }
  }

  const detailX = pageW - margin - 95;
  doc.setFontSize(11);
  setFont(doc, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`Proforma No : ${data.proformaNumber}`, detailX, margin + 7);
  doc.setFontSize(9.5);
  setFont(doc, "normal");
  const details = [
    `Proforma Date : ${formatPdfDate(data.proformaDate)}`,
    `Valid Until : ${formatPdfDate(data.validityDate)}`,
    `Quotation Ref : ${data.quotationCode || "—"}`,
    `Contact Person : ${data.contact?.name || "-"}`,
    `Contact No : ${data.contact?.phone || data.customer?.phone || "-"}`,
    `Payment Terms : ${data.paymentTerms || "-"}`,
    `Delivery Terms : ${data.deliveryTerms || "-"}`,
  ];
  let dy = margin + 12;
  for (const line of details) {
    doc.text(line, detailX, dy);
    dy += 4.5;
  }

  let y = margin + headerH + 5;
  const halfW = (contentW - 5) / 2;
  const billLines = [
    data.customer?.name || "—",
    data.customer?.customerCode ? `Code: ${data.customer.customerCode}` : "",
    data.customer?.billingAddress || "",
    data.customer?.city ? `${data.customer.city}, ${data.customer?.state || ""}` : "",
    data.customer?.gstNumber ? `GSTIN: ${data.customer.gstNumber}` : "",
  ].filter(Boolean);
  const shipLines = [
    data.customer?.name || "—",
    data.customer?.customerCode ? `Code: ${data.customer.customerCode}` : "",
    data.customer?.shippingAddress || data.customer?.billingAddress || "",
    data.customer?.city ? `${data.customer.city}, ${data.customer?.state || ""}` : "",
    data.customer?.gstNumber ? `GSTIN: ${data.customer.gstNumber}` : "",
  ].filter(Boolean);

  const boxH = Math.max(28, Math.max(billLines.length, shipLines.length) * 3.6 + 10);
  drawBox(doc, margin, y, halfW, boxH, "BILL TO", billLines);
  drawBox(doc, margin + halfW + 5, y, halfW, boxH, "SHIP TO", shipLines);

  y += boxH + 4;

  // Determine GST tax treatment (intra-state → CGST+SGST, inter-state → IGST)
  const gstResult = resolveTaxTreatment(
    data.companyGstin,
    data.customer?.gstNumber,
    data.customer?.state,
  );
  const isInterState = gstResult.treatment === "inter_state";
  const isUnknown = gstResult.treatment === "unknown";

  const computedItems = data.items.map((it) => {
    const cutting = it.cuttingCharge || 0;
    const taxable = it.quantity * it.unitPrice * (1 - (it.discountPercent || 0) / 100);
    const taxPct = it.taxPercent || 18;
    const taxAmount = taxable * (taxPct / 100);
    const cgst = isInterState ? 0 : taxAmount / 2;
    const sgst = isInterState ? 0 : taxAmount / 2;
    const igst = isInterState ? taxAmount : 0;
    const total = taxable + taxAmount + cutting;
    return { ...it, taxable, taxAmount, cgst, sgst, igst, cutting, total };
  });

  const totalTaxable = computedItems.reduce((s, it) => s + it.taxable, 0);
  const totalTax = computedItems.reduce((s, it) => s + it.taxAmount, 0);
  const totalCutting = computedItems.reduce((s, it) => s + it.cutting, 0);
  const totalQty = computedItems.reduce((s, it) => s + it.quantity, 0);
  const totalPcs = computedItems.reduce((s, it) => s + (it.numberOfPieces || 0), 0);
  const transportCharge = data.transportCharge || 0;
  const otherCharges = data.otherCharges || 0;
  const weighingLoadingCharge = data.weighingLoadingCharge || 0;
  const deliveryCharge = data.deliveryCharge || 0;
  const testingCharge = data.testingCharge || 0;
  const extraCharges = transportCharge + otherCharges + weighingLoadingCharge + deliveryCharge + testingCharge;
  const grandTotal = totalTaxable + totalTax + totalCutting + extraCharges;

  // Build table head — for inter-state, replace CGST Val + SGST Val with a single IGST Val column
  const head = isInterState
    ? [["S.No", "Material\nDescription", "Item\nCode", "Make", "Length\n(mm)", "No of\nPcs", "Qty", "UOM", "Price", "Tax Val", "IGST Val", "Cutting\nCharge", "Total\nAmount", "Delivery\n(Days)", "Remarks"]]
    : [["S.No", "Material\nDescription", "Item\nCode", "Make", "Length\n(mm)", "No of\nPcs", "Qty", "UOM", "Price", "Tax Val", "CGST Val", "SGST Val", "Cutting\nCharge", "Total\nAmount", "Delivery\n(Days)", "Remarks"]];

  const body = computedItems.map((it, idx) => {
    const base = [
      String(idx + 1).padStart(2, "0"),
      it.description || "—",
      it.productType || "—",
      it.rmMake || "—",
      it.lengthMm != null ? String(it.lengthMm) : "—",
      it.numberOfPieces != null ? String(it.numberOfPieces) : "—",
      String(it.quantity),
      it.unit || "Kgs",
      formatCurrency(it.unitPrice),
      formatCurrency(it.taxable),
    ];
    if (isInterState) {
      return [
        ...base,
        formatCurrency(it.igst),
        formatCurrency(it.cuttingCharge || 0),
        formatCurrency(it.total),
        it.deliveryDays != null ? String(it.deliveryDays) : "—",
        it.remarks || "",
      ];
    }
    return [
      ...base,
      formatCurrency(it.cgst),
      formatCurrency(it.sgst),
      formatCurrency(it.cuttingCharge || 0),
      formatCurrency(it.total),
      it.deliveryDays != null ? String(it.deliveryDays) : "—",
      it.remarks || "",
    ];
  });

  if (isInterState) {
    body.push([
      "", "", "", "", "", "Total", totalPcs ? String(totalPcs) : "0", totalQty ? String(totalQty) : "0", "", "", "", "", "", formatCurrency(grandTotal), "", "",
    ]);
  } else {
    body.push([
      "", "", "", "", "", "Total", totalPcs ? String(totalPcs) : "0", totalQty ? String(totalQty) : "0", "", "", "", "", "", "", formatCurrency(grandTotal), "", "",
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin + 5, bottom: 25 },
    head,
    body,
    styles: {
      font: "NotoSans",
      fontSize: 6,
      cellPadding: 0.6,
      overflow: "linebreak",
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
      fontSize: 6,
      halign: "center",
      valign: "middle",
    },
    columnStyles: isInterState
      ? {
          0: { halign: "center" },
          1: { halign: "left" },
          3: { halign: "left" },
          8: { halign: "right" },
          9: { halign: "right" },
          10: { halign: "right" },
          11: { halign: "right" },
          12: { halign: "right" },
        }
      : {
          0: { halign: "center" },
          1: { halign: "left" },
          3: { halign: "left" },
          8: { halign: "right" },
          9: { halign: "right" },
          10: { halign: "right" },
          11: { halign: "right" },
          12: { halign: "right" },
          13: { halign: "right" },
        },
    didDrawPage: () => {
      addPageFooter(doc, { left: "This is a computer-generated proforma invoice.", page: doc.getNumberOfPages() });
    },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  const bottomH = 55;
  if (y + bottomH > pageH - 15) {
    doc.addPage();
    y = margin;
  }

  const leftW = contentW * 0.55;
  const rightW = contentW * 0.43;
  const rightX = pageW - margin - rightW;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, leftW, bottomH);

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Comments :", margin + 3, y + 5);
  doc.setFontSize(8);
  setFont(doc, "normal");
  const notes = data.notes ? doc.splitTextToSize(data.notes, leftW - 6) : [""];
  let cy = y + 9;
  for (const line of notes) {
    doc.text(line, margin + 3, cy);
    cy += 3.5;
  }

  // Tax treatment warning (unknown state) — shown in red below comments
  if (isUnknown && gstResult.warning) {
    doc.setFontSize(7);
    setFont(doc, "bold");
    doc.setTextColor(200, 0, 0);
    const warnLines = doc.splitTextToSize(`TAX WARNING: ${gstResult.warning}`, leftW - 6);
    for (const wl of warnLines) {
      if (cy > y + 22) break;
      doc.text(wl, margin + 3, cy);
      cy += 3.2;
    }
    doc.setTextColor(0, 0, 0);
  }

  // State field mismatch warning (GSTIN state code != state field)
  if (gstResult.stateFieldMismatch) {
    doc.setFontSize(7);
    setFont(doc, "bold");
    doc.setTextColor(200, 0, 0);
    const mismatchLines = doc.splitTextToSize(
      `DATA WARNING: Customer's GSTIN state code does not match the state field. Using GSTIN state code for tax treatment.`,
      leftW - 6,
    );
    for (const wl of mismatchLines) {
      if (cy > y + 22) break;
      doc.text(wl, margin + 3, cy);
      cy += 3.2;
    }
    doc.setTextColor(0, 0, 0);
  }

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Amount In Words :", margin + 3, y + 25);
  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.text(toIndianWords(grandTotal), margin + 3, y + 30);

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Terms & Condition :", margin + 3, y + 38);
  doc.setFontSize(7);
  setFont(doc, "normal");
  const tnc = data.termsAndConditions || DEFAULT_TERMS;
  const tncLines = doc.splitTextToSize(tnc, leftW - 6);
  cy = y + 42;
  for (const line of tncLines) {
    if (cy > y + bottomH - 3) break;
    doc.text(line, margin + 3, cy);
    cy += 3.2;
  }

  doc.setFillColor(240, 240, 240);
  doc.rect(rightX, y, rightW, bottomH, "FD");

  const summary = [
    { label: "Taxable Val", value: totalTaxable },
    { label: isInterState ? "IGST" : "Tax Charges", value: totalTax },
    { label: "Transport Charges", value: transportCharge },
    { label: "Other Charges", value: otherCharges },
    { label: "Weighing/Loading Charge", value: weighingLoadingCharge },
    { label: "Delivery Charge", value: deliveryCharge },
    { label: "Testing Charge", value: testingCharge },
    { label: "Total Amount", value: grandTotal, bold: true },
  ];

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  cy = y + 5;
  for (const row of summary) {
    doc.setFontSize(8);
    setFont(doc, row.bold ? "bold" : "normal");
    if (row.bold) doc.setTextColor(...PdfColors.primary);
    else doc.setTextColor(30, 0, 0);
    doc.text(row.label, rightX + 4, cy);
    doc.text(formatCurrency(row.value), rightX + rightW - 4, cy, { align: "right" });
    if (!row.bold) doc.line(rightX + 3, cy + 2, rightX + rightW - 3, cy + 2);
    cy += bottomH / summary.length;
  }

  const sigW = 60;
  const sigH = 18;
  const sigX = rightX;
  const sigY = y + bottomH + 4;
  if (sigY + sigH <= pageH - 10) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.rect(sigX, sigY, sigW, sigH);
    doc.setFontSize(8);
    setFont(doc, "bold");
    doc.text("For", sigX + 3, sigY + 5);
    doc.setFontSize(7);
    doc.text("SHAHNAZ BRIGHT STEEL", sigX + 3, sigY + 10);
    doc.setFontSize(7);
    setFont(doc, "normal");
    doc.line(sigX + 3, sigY + 13, sigX + sigW - 3, sigY + 13);
    doc.text("Authorized Signature", sigX + 3, sigY + 17);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, { left: "This is a computer-generated proforma invoice.", page: i });
  }

  return doc;
}
