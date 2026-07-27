import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  setupPdfFonts,
  setFont,
  formatCurrency,
  formatPdfDate,
  drawDivider,
  addDocumentHeader,
  addPageFooter,
  PdfColors,
} from "./pdf-shared";

export interface QuotationPdfItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
  lineTotal?: number;
  totalPrice?: number;
  hsn?: string | null;
  unit?: string | null;
  product?: { name: string; productCode: string } | null;
}

export interface QuotationPdfData {
  quotationCode: string;
  revisionNumber: number;
  status: string;
  validUntil: Date | string | null;
  createdAt: Date | string;
  subtotal: number;
  discountPercent: number;
  taxAmount: number;
  finalAmount: number;
  totalAmount: number;
  termsAndConditions?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  freightTerms?: string | null;
  leadTimeDays?: number | null;
  customer?: {
    name: string;
    customerCode?: string | null;
    billingAddress?: string | null;
    city?: string | null;
    gstNumber?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  contact?: {
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  deal?: {
    dealName: string;
    opportunityCode?: string | null;
  } | null;
  company?: {
    name: string;
  } | null;
  items: QuotationPdfItem[];
  createdBy?: { name: string } | null;
  companyAddress?: string;
  companyGstin?: string;
  companyPhone?: string;
  companyEmail?: string;
  generatedByName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function drawInfoBox(
  doc: jsPDF,
  title: string,
  x: number,
  y: number,
  w: number,
  content: { label?: string; value?: string }[],
): number {
  const lineH = 3.8;
  let h = 8 + content.length * lineH;

  // Measure dynamic height for wrapped values
  doc.setFontSize(8);
  setFont(doc, "normal");
  for (const item of content) {
    if (item.value && item.value.length > 25) {
      const lines = doc.splitTextToSize(item.value, w - 8).length;
      h += (lines - 1) * (lineH - 0.5);
    }
  }

  // Box background + border
  doc.setFillColor(...PdfColors.slate50);
  doc.setDrawColor(...PdfColors.slate200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

  // Title bar
  doc.setFillColor(...PdfColors.primary);
  doc.roundedRect(x, y, w, 6, 1.5, 1.5, "F");
  // Flatten bottom of title bar
  doc.rect(x, y + 3, w, 3, "F");

  doc.setFontSize(7);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.white);
  doc.text(title.toUpperCase(), x + 3, y + 4);

  let cy = y + 10;
  for (const item of content) {
    const label = item.label ? `${item.label}: ` : "";
    const full = `${label}${item.value || "—"}`;
    doc.setFontSize(8);
    setFont(doc, "bold");
    doc.setTextColor(...PdfColors.slate500);
    const labelW = item.label ? doc.getTextWidth(label) : 0;
    if (labelW > 0) doc.text(label, x + 3, cy);

    setFont(doc, "normal");
    doc.setTextColor(item.value ? 30 : 148, item.value ? 41 : 163, item.value ? 59 : 184);
    const valueX = x + 3 + labelW;
    const maxW = w - 6 - labelW;
    const lines = doc.splitTextToSize(item.value || "—", maxW);
    doc.text(lines, valueX, cy);
    cy += lines.length * (lineH - 0.5);
  }

  return y + h;
}

function formatTermsBlock(
  doc: jsPDF,
  label: string,
  content: string,
  startY: number,
  pageH: number,
  margin: number,
): number {
  if (!content) return startY;
  let y = startY;
  if (y > pageH - 40) {
    doc.addPage();
    y = margin + 5;
  }

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.slate500);
  doc.text(label, margin, y);
  y += 4;

  setFont(doc, "normal");
  doc.setTextColor(...PdfColors.slate600);
  const lines = doc.splitTextToSize(content, 180);
  for (const line of lines) {
    if (y > pageH - 18) {
      doc.addPage();
      y = margin + 5;
    }
    doc.text(line, margin, y);
    y += 3.5;
  }
  return y + 2;
}

/**
 * Right-align amount strings so decimal points line up.
 */
function drawAlignedAmount(doc: jsPDF, amount: string, decimalX: number, y: number): void {
  const parts = amount.split(".");
  const intPart = parts[0];
  const fracPart = parts.length > 1 ? `.${parts[1]}` : "";
  const intW = doc.getTextWidth(intPart);
  doc.text(intPart, decimalX - intW, y);
  if (fracPart) doc.text(fracPart, decimalX, y);
}

// ─── Main PDF generator ─────────────────────────────────────────────────────

/**
 * Generate a professional, visually-polished quotation PDF using jsPDF.
 * Includes: branded header, customer/contact info cards, line-items table with
 * zebra striping, decimal-aligned totals, commercial terms, T&Cs, and signature.
 */
export function generateQuotationPdf(data: QuotationPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupPdfFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - 2 * margin;

  const companyName = data.company?.name || "SUKI CRM";

  // ── Header ──
  let y = addDocumentHeader(doc, {
    companyName,
    companyAddress: data.companyAddress || "",
    companyGstin: data.companyGstin || "",
    companyPhone: data.companyPhone || "",
    companyEmail: data.companyEmail || "",
    badgeText: "QUOTATION",
    docCode: data.quotationCode,
    metaLines: [
      `Revision: R${data.revisionNumber}`,
      `Status: ${data.status}`,
      `Valid Until: ${formatPdfDate(data.validUntil)}`,
    ],
  });

  // ── Meta row ──
  const metaColW = contentW / 3;
  const meta = [
    { label: "Quotation Date", value: formatPdfDate(data.createdAt) },
    { label: "Valid Until", value: formatPdfDate(data.validUntil) },
    { label: "Status", value: data.status },
  ];
  for (let i = 0; i < meta.length; i++) {
    const cx = margin + i * metaColW;
    doc.setFontSize(7);
    setFont(doc, "bold");
    doc.setTextColor(...PdfColors.slate400);
    doc.text(meta[i].label.toUpperCase(), cx, y);
    doc.setFontSize(10);
    setFont(doc, "normal");
    doc.setTextColor(...PdfColors.primaryDark);
    doc.text(meta[i].value, cx, y + 4.5);
  }
  y += 12;

  // ── Bill To / Contact cards ──
  const boxGap = 4;
  const boxW = (contentW - boxGap) / 2;

  const customerContent = [
    { label: undefined, value: data.customer?.name || "—" },
    { label: "Code", value: data.customer?.customerCode || "" },
    { label: "Address", value: data.customer?.billingAddress || "" },
    { label: "City", value: data.customer?.city || "" },
    { label: "GSTIN", value: data.customer?.gstNumber || "" },
    { label: "Phone", value: data.customer?.phone || "" },
    { label: "Email", value: data.customer?.email || "" },
  ].filter((c) => c.value || c.label === undefined);

  const contactContent = [
    { label: undefined, value: data.contact?.name || "—" },
    { label: "Email", value: data.contact?.email || "" },
    { label: "Phone", value: data.contact?.phone || "" },
  ].filter((c) => c.value || c.label === undefined);

  const leftH = drawInfoBox(doc, "Bill To", margin, y, boxW, customerContent);
  const rightH = drawInfoBox(doc, "Contact", margin + boxW + boxGap, y, boxW, contactContent);
  y = Math.max(leftH, rightH) + 6;

  // ── Deal info ──
  if (data.deal) {
    doc.setFillColor(...PdfColors.slate100);
    doc.setDrawColor(...PdfColors.slate200);
    doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "FD");
    doc.setFontSize(9);
    setFont(doc, "bold");
    doc.setTextColor(...PdfColors.primaryDark);
    doc.text(`Opportunity: ${data.deal.dealName}`, margin + 3, y + 5);
    if (data.deal.opportunityCode) {
      setFont(doc, "normal");
      doc.setTextColor(...PdfColors.slate500);
      doc.text(data.deal.opportunityCode, pageW - margin - 3, y + 5, { align: "right" });
    }
    y += 11;
  }

  // ── Line items table ──
  const head = [["#", "Description", "HSN", "Qty", "UOM", "Unit Price", "Disc%", "Tax%", "Line Total"]];
  const body = data.items.map((it, idx) => [
    String(idx + 1),
    it.description || it.product?.name || "—",
    it.hsn || "—",
    String(it.quantity),
    it.unit || "Nos",
    formatCurrency(it.unitPrice),
    `${it.discountPercent || 0}%`,
    `${it.taxPercent || 0}%`,
    formatCurrency(it.lineTotal || it.totalPrice || 0),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin + 5, bottom: 22 },
    head,
    body,
    styles: {
      font: "NotoSans",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      lineColor: [203, 213, 225], // #cbd5e1
      lineWidth: 0.25,
      textColor: 30,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 12, halign: "right" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 12, halign: "center" },
      7: { cellWidth: 12, halign: "center" },
      8: { cellWidth: 26, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => {
      addPageFooter(doc, {
        left: "This is a computer-generated quotation and does not require a physical signature.",
      });
    },
  });

  // lastAutoTable is added by jspdf-autotable at runtime
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Totals section (right-aligned, decimal-aligned) ──
  const netSubtotal = data.subtotal || data.totalAmount;
  const discountPct = data.discountPercent || 0;
  const grossSubtotal = discountPct > 0 ? netSubtotal / (1 - discountPct / 100) : netSubtotal;
  const discountAmount = grossSubtotal - netSubtotal;

  const totals: Array<{ label: string; value: string; style?: "normal" | "deduction" | "grand" }> = [
    { label: "Gross Total", value: formatCurrency(grossSubtotal), style: "normal" },
    { label: `Discount (${discountPct}%)`, value: `-${formatCurrency(discountAmount)}`, style: "deduction" },
    { label: "Net Subtotal", value: formatCurrency(netSubtotal), style: "normal" },
    { label: "Tax (GST)", value: formatCurrency(data.taxAmount || 0), style: "normal" },
  ];

  const totalsW = 80;
  const totalsX = pageW - margin - totalsW;
  const labelX = totalsX + 3;
  // All amount decimal points line up at this x; integer parts render to the left.
  const decimalX = pageW - margin - 3;

  // Render totals rows
  doc.setDrawColor(...PdfColors.slate200);
  doc.setLineWidth(0.3);
  for (const row of totals) {
    doc.setFontSize(10);
    if (row.style === "deduction") {
      setFont(doc, "normal");
      doc.setTextColor(...PdfColors.red);
    } else {
      setFont(doc, "normal");
      doc.setTextColor(...PdfColors.slate600);
    }
    doc.text(row.label, labelX, y);
    drawAlignedAmount(doc, row.value, decimalX, y);
    y += 6;
  }

  // Grand total highlighted band
  const grandY = y + 2;
  const bandH = 9;
  doc.setFillColor(...PdfColors.primary);
  doc.roundedRect(totalsX, grandY - 1, totalsW, bandH, 2, 2, "F");
  doc.setFontSize(12);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.white);
  doc.text("Grand Total", labelX, grandY + 5);
  drawAlignedAmount(doc, formatCurrency(data.finalAmount), decimalX, grandY + 5);
  y = grandY + bandH + 6;

  // Ensure we have enough room for terms + signature on this page
  if (y > pageH - 55) {
    doc.addPage();
    y = margin + 5;
  }

  // ── Section divider ──
  drawDivider(doc, y, PdfColors.slate200, 0.3);
  y += 5;

  // ── Commercial terms ──
  if (data.paymentTerms || data.deliveryTerms || data.freightTerms || data.leadTimeDays) {
    doc.setFontSize(9);
    setFont(doc, "bold");
    doc.setTextColor(...PdfColors.slate500);
    doc.text("COMMERCIAL TERMS", margin, y);
    y += 5;

    const terms: Array<[string, string]> = [
      ["Payment", data.paymentTerms || "As per standard terms"],
      ["Delivery", data.deliveryTerms || "As per standard terms"],
      ["Freight", data.freightTerms || "Extra at actuals"],
      ["Lead Time", data.leadTimeDays ? `${data.leadTimeDays} days` : "As per standard"],
    ];

    const termColW = (contentW - 6) / 2;
    for (let i = 0; i < terms.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = margin + col * (termColW + 6);
      const ty = y + row * 6;
      doc.setFontSize(8);
      setFont(doc, "bold");
      doc.setTextColor(...PdfColors.slate500);
      doc.text(`${terms[i][0]}:`, tx, ty);
      setFont(doc, "normal");
      doc.setTextColor(...PdfColors.slate600);
      const valLines = doc.splitTextToSize(terms[i][1], termColW - 22);
      doc.text(valLines[0] || "", tx + 22, ty);
    }
    y += Math.ceil(terms.length / 2) * 6 + 4;
  }

  // ── Terms & Conditions ──
  y = formatTermsBlock(doc, "TERMS & CONDITIONS", data.termsAndConditions || "", y, pageH, margin);

  // ── Signature box ──
  if (y > pageH - 42) {
    doc.addPage();
    y = margin + 5;
  }
  const sigW = 70;
  const sigX = pageW - margin - sigW;
  const sigH = 22;
  const sigY = y + 4;

  doc.setFillColor(...PdfColors.white);
  doc.setDrawColor(...PdfColors.slate200);
  doc.setLineWidth(0.3);
  doc.roundedRect(sigX, sigY, sigW, sigH, 1.5, 1.5, "FD");

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.slate500);
  doc.text("For", sigX + 3, sigY + 5);
  doc.setTextColor(...PdfColors.primaryDark);
  doc.text(companyName, sigX + 3, sigY + 10);

  doc.setDrawColor(...PdfColors.slate400);
  doc.setLineWidth(0.4);
  doc.line(sigX + 3, sigY + 15, sigX + sigW - 3, sigY + 15);

  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(...PdfColors.slate500);
  doc.text("Authorized Signature", sigX + 3, sigY + 19);

  y = sigY + sigH + 4;

  // ── Generation info ──
  if (y > pageH - 18) {
    doc.addPage();
    y = margin + 5;
  }
  doc.setFontSize(7);
  setFont(doc, "normal");
  doc.setTextColor(...PdfColors.slate400);
  if (data.generatedByName) {
    doc.text(`Generated by ${data.generatedByName} on ${new Date().toLocaleString("en-IN")}`, margin, y);
    y += 3.5;
  }
  doc.text(`Created by ${data.createdBy?.name || "—"}`, margin, y);

  // Final footer pass on the last page if autoTable didn't add it
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, {
      left: "This is a computer-generated quotation and does not require a physical signature.",
      page: i,
    });
  }

  return doc;
}
