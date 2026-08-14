import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  setupPdfFonts,
  setFont,
  formatCurrency,
  formatPdfDate,
  addPageFooter,
  PdfColors,
} from "./pdf-shared";

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

  const companyName = data.company?.name || "SHAHNAZ BRIGHT STEEL INDUSTRIES PRIVATE LIMITED";

  const headerH = 30;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, margin, contentW, headerH);

  doc.setFillColor(...PdfColors.primary);
  doc.rect(margin + 2, margin + 2, 18, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  setFont(doc, "bold");
  doc.text("SBS", margin + 4, margin + 12);

  doc.setTextColor(...PdfColors.primary);
  doc.setFontSize(14);
  setFont(doc, "bold");
  doc.text(companyName, margin + 24, margin + 8);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  setFont(doc, "normal");
  const addr = data.companyAddress || "";
  const addrLines = doc.splitTextToSize(addr, 110);
  let ay = margin + 13;
  for (const line of addrLines) {
    doc.text(line, margin + 24, ay);
    ay += 3.5;
  }
  const contactParts: string[] = [
    data.companyPhone ? `Phone: ${data.companyPhone}` : "",
    data.companyEmail ? data.companyEmail : "",
    data.companyGstin ? `GSTIN: ${data.companyGstin}` : "",
  ].filter(Boolean);
  if (contactParts.length > 0) {
    doc.text(contactParts.join(" | "), margin + 24, ay);
  }

  const detailX = pageW - margin - 95;
  doc.setFontSize(9);
  setFont(doc, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`Proforma No : ${data.proformaNumber}`, detailX, margin + 6);
  doc.setFontSize(8);
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
  let dy = margin + 10;
  for (const line of details) {
    doc.text(line, detailX, dy);
    dy += 4;
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

  const computedItems = data.items.map((it) => {
    const cutting = it.cuttingCharge || 0;
    const taxable = it.quantity * it.unitPrice * (1 - (it.discountPercent || 0) / 100);
    const taxPct = it.taxPercent || 18;
    const taxAmount = taxable * (taxPct / 100);
    const cgst = taxAmount / 2;
    const sgst = taxAmount / 2;
    const total = taxable + taxAmount + cutting;
    return { ...it, taxable, taxAmount, cgst, sgst, cutting, total };
  });

  const totalTaxable = computedItems.reduce((s, it) => s + it.taxable, 0);
  const totalTax = computedItems.reduce((s, it) => s + it.taxAmount, 0);
  const totalCutting = computedItems.reduce((s, it) => s + it.cutting, 0);
  const totalQty = computedItems.reduce((s, it) => s + it.quantity, 0);
  const totalPcs = computedItems.reduce((s, it) => s + (it.numberOfPieces || 0), 0);
  const grandTotal = totalTaxable + totalTax + totalCutting;

  const head = [["S.No", "Material\nDescription", "Item\nCode", "Make", "Length\n(mm)", "No of\nPcs", "Qty", "UOM", "Price", "Tax Val", "CGST Val", "SGST Val", "Cutting\nCharge", "Total\nAmount", "Delivery\n(Days)", "Remarks"]];
  const body = computedItems.map((it, idx) => [
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
    formatCurrency(it.cgst),
    formatCurrency(it.sgst),
    formatCurrency(it.cuttingCharge || 0),
    formatCurrency(it.total),
    it.deliveryDays != null ? String(it.deliveryDays) : "—",
    it.remarks || "",
  ]);
  body.push([
    "", "", "", "", "", "Total", totalPcs ? String(totalPcs) : "0", totalQty ? String(totalQty) : "0", "", "", "", "", "", "", formatCurrency(grandTotal), "", "",
  ]);

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
    columnStyles: {
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
    { label: "Tax Charges", value: totalTax },
    { label: "Transport Charges", value: 0 },
    { label: "Other Charges", value: 0 },
    { label: "Weighing/Loading Charge", value: 0 },
    { label: "Delivery Charge", value: 0 },
    { label: "Testing Charge", value: 0 },
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
    doc.text(companyName, sigX + 3, sigY + 10);
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
