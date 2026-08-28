import { jsPDF } from "jspdf";
import {
  setupPdfFonts,
  setFont,
  formatCurrency,
  formatPdfDate,
  addDocumentHeader,
  addPageFooter,
  PdfColors,
} from "./pdf-shared";

export interface RequirementsPdfMeetingLog {
  meetingDate?: Date | string | null;
  meetingType?: string | null;
  meetingMode?: string | null;
  participants?: string | null;
  agenda?: string | null;
  outcome?: string | null;
  notes?: string | null;
  attemptNumber?: number;
}

export interface RequirementsPdfData {
  opportunityCode: string;
  dealName: string;
  stage: string;
  dealValue: number;
  expectedCloseDate?: Date | string | null;
  createdAt: Date | string;
  customer: {
    name: string;
    customerCode?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    industryType?: string | null;
  } | null;
  lead: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    designation?: string | null;
    industryType?: string | null;
    city?: string | null;
    leadSource?: string | null;
    estimatedValue?: number | null;
    budgetAsked?: string | null;
    timelineAsked?: string | null;
    notes?: string | null;
  } | null;
  contact: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    designation?: string | null;
  } | null;
  detail: {
    companyName?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    industry?: string | null;
    employeeCount?: number | null;
    currentChallenges?: string | null;
    businessNeed?: string | null;
    expectedOutcome?: string | null;
    urgencyPriority?: string | null;
    budgetRange?: string | null;
    expectedBudget?: number | null;
    finalDiscussedBudget?: number | null;
    timeline?: string | null;
    procurementProcess?: string | null;
    decisionMaker?: string | null;
    influencer?: string | null;
    budgetOwner?: string | null;
    currentVendor?: string | null;
    competitorsEvaluated?: string | null;
    expectedGoLive?: Date | string | null;
    businessGoals?: string | null;
    painPoints?: string | null;
    requiredFeatures?: string | null;
    nextSteps?: string | null;
    objections?: string | null;
    internalSalesNotes?: string | null;
    presalesNotes?: string | null;
  } | null;
  meetingLogs: RequirementsPdfMeetingLog[];
  company?: { name: string } | null;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  generatedByName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderLabelValue(
  doc: jsPDF,
  label: string,
  value: string | number,
  x: number,
  y: number,
  maxW: number,
): number {
  const v = String(value ?? "");
  const isEmpty = v === "" || v === "—";

  doc.setFontSize(7);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.slate400);
  doc.text(label, x, y);

  doc.setFontSize(8.5);
  setFont(doc, "normal");
  if (isEmpty) {
    doc.setTextColor(...PdfColors.slate400);
    doc.text("—", x, y + 4);
    return y + 8;
  }
  doc.setTextColor(...PdfColors.primaryDark);
  const lines = doc.splitTextToSize(v, maxW);
  doc.text(lines, x, y + 4);
  return y + 4 + lines.length * 3.6;
}

function sectionHeader(doc: jsPDF, y: number, contentW: number, title: string): number {
  const margin = 15;
  doc.setFillColor(...PdfColors.primary);
  doc.rect(margin, y, contentW, 7, "F");
  doc.setFontSize(10);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.white);
  doc.text(title, margin + 3, y + 5);
  return y + 10;
}

function renderGridRow(
  doc: jsPDF,
  rows: Array<{ label: string; value: string | number }>,
  x: number,
  y: number,
  contentW: number,
  cols: 2 | 3 = 2,
): number {
  const margin = 15;
  const gap = 4;
  const colW = (contentW - (cols - 1) * gap) / cols;
  let currentY = y;
  let maxRowY = y;

  for (let i = 0; i < rows.length; i++) {
    const col = i % cols;
    const rowStartY = currentY;
    const cellX = x + col * (colW + gap);
    const newY = renderLabelValue(doc, rows[i].label, rows[i].value, cellX, rowStartY, colW - 2);
    maxRowY = Math.max(maxRowY, newY);
    if (col === cols - 1) {
      currentY = maxRowY + 2;
      maxRowY = currentY;
    }
  }

  // If last row didn't fill all columns, still advance
  return rows.length % cols === 0 ? currentY : maxRowY;
}

function textBlock(doc: jsPDF, label: string, value: string, x: number, y: number, contentW: number): number {
  const v = value || "—";
  const isEmpty = v === "—";
  const margin = 15;
  const pageH = doc.internal.pageSize.getHeight();
  const safeBottom = pageH - 20; // leave room for footer line/text at pageH - 12 / -8

  if (y > safeBottom - 8) {
    doc.addPage();
    y = margin + 5;
  }

  doc.setFontSize(7);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.slate400);
  doc.text(label, x, y);
  y += 4;

  doc.setFontSize(8.5);
  setFont(doc, "normal");
  if (isEmpty) {
    doc.setTextColor(...PdfColors.slate400);
  } else {
    doc.setTextColor(...PdfColors.primaryDark);
  }
  const lines = doc.splitTextToSize(v, contentW);
  for (const line of lines) {
    if (y > safeBottom - 4) {
      doc.addPage();
      y = margin + 5;
    }
    doc.text(line, x, y);
    y += 3.7;
  }
  return y + 2;
}

function meetingCard(
  doc: jsPDF,
  m: RequirementsPdfMeetingLog,
  idx: number,
  x: number,
  y: number,
  contentW: number,
): number {
  const pageH = doc.internal.pageSize.getHeight();
  const safeBottom = pageH - 20;
  if (y > safeBottom - 40) {
    doc.addPage();
    y = 15 + 5;
  }

  const cardH = 32;
  doc.setFillColor(...PdfColors.white);
  doc.setDrawColor(...PdfColors.slate200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, contentW, cardH, 2, 2, "FD");

  // Card header band
  doc.setFillColor(...PdfColors.slate100);
  doc.roundedRect(x, y, contentW, 7, 2, 2, "F");
  // Flatten bottom of header band
  doc.rect(x, y + 4, contentW, 3, "F");

  doc.setFontSize(9);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.primary);
  doc.text(`Meeting ${m.attemptNumber ?? idx + 1}`, x + 4, y + 5);

  const innerY = y + 11;
  const halfW = (contentW - 8) / 2;

  renderLabelValue(
    doc,
    "Date",
    formatPdfDate(m.meetingDate),
    x + 4,
    innerY,
    halfW - 4,
  );
  renderLabelValue(
    doc,
    "Type",
    m.meetingType || "—",
    x + 4 + halfW,
    innerY,
    halfW - 4,
  );

  const row2Y = innerY + 8;
  renderLabelValue(doc, "Mode", m.meetingMode || "—", x + 4, row2Y, halfW - 4);
  renderLabelValue(doc, "Outcome", m.outcome || "—", x + 4 + halfW, row2Y, halfW - 4);

  let cy = row2Y + 8;
  if (m.participants) cy = textBlock(doc, "Participants", m.participants, x + 4, cy, contentW - 8);
  if (m.agenda) cy = textBlock(doc, "Agenda", m.agenda, x + 4, cy, contentW - 8);
  if (m.notes) cy = textBlock(doc, "Notes / Feedback", m.notes, x + 4, cy, contentW - 8);

  // Recalculate actual card height based on content overflow
  const actualH = Math.max(cardH, cy - y + 2);
  // Clear and redraw card with correct height
  if (actualH > cardH) {
    doc.setFillColor(...PdfColors.white);
    doc.setDrawColor(...PdfColors.slate200);
    doc.roundedRect(x, y, contentW, actualH, 2, 2, "FD");
    doc.setFillColor(...PdfColors.slate100);
    doc.roundedRect(x, y, contentW, 7, 2, 2, "F");
    doc.rect(x, y + 4, contentW, 3, "F");
    doc.setFontSize(9);
    setFont(doc, "bold");
    doc.setTextColor(...PdfColors.primary);
    doc.text(`Meeting ${m.attemptNumber ?? idx + 1}`, x + 4, y + 5);

    renderLabelValue(
      doc,
      "Date",
      formatPdfDate(m.meetingDate),
      x + 4,
      y + 11,
      halfW - 4,
    );
    renderLabelValue(
      doc,
      "Type",
      m.meetingType || "—",
      x + 4 + halfW,
      y + 11,
      halfW - 4,
    );
    let redrawY = y + 19;
    renderLabelValue(doc, "Mode", m.meetingMode || "—", x + 4, redrawY, halfW - 4);
    renderLabelValue(doc, "Outcome", m.outcome || "—", x + 4 + halfW, redrawY, halfW - 4);
    redrawY += 8;
    if (m.participants) redrawY = textBlock(doc, "Participants", m.participants, x + 4, redrawY, contentW - 8);
    if (m.agenda) redrawY = textBlock(doc, "Agenda", m.agenda, x + 4, redrawY, contentW - 8);
    if (m.notes) redrawY = textBlock(doc, "Notes / Feedback", m.notes, x + 4, redrawY, contentW - 8);
    return redrawY + 4;
  }

  return y + actualH + 4;
}

// ─── Main PDF generator ─────────────────────────────────────────────────────

/**
 * Generate a professional Requirements Summary PDF using jsPDF.
 * Sections: Customer & Contact Info, Business Requirements,
 *           Commercial Information, Demo/Meeting Summary.
 * Handles multi-page automatically with consistent headers/footers.
 */
export function generateRequirementsPdf(data: RequirementsPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupPdfFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - 2 * margin;
  const safeBottom = pageH - 20; // leave room for footer line/text at pageH - 12 / -8

  const companyName = data.company?.name || "Shahnaz CRM";

  // ── Header ──
  let y = addDocumentHeader(doc, {
    companyName,
    companyAddress: data.companyAddress || "",
    companyPhone: data.companyPhone || "",
    companyEmail: data.companyEmail || "",
    badgeText: "REQUIREMENTS SUMMARY",
    docCode: data.opportunityCode,
    metaLines: [
      `Generated: ${formatPdfDate(new Date())}`,
      data.generatedByName ? `By: ${data.generatedByName}` : "",
    ].filter(Boolean),
  });

  // ── Opportunity summary card ──
  doc.setFillColor(...PdfColors.slate50);
  doc.setDrawColor(...PdfColors.slate200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, "FD");

  doc.setFontSize(10);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.primaryDark);
  doc.text(data.dealName, margin + 4, y + 6);

  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(...PdfColors.slate500);
  const summaryParts = [
    `Stage: ${data.stage}`,
    `Deal Value: ${formatCurrency(data.dealValue, { decimals: 0 })}`,
    `Expected Close: ${formatPdfDate(data.expectedCloseDate)}`,
    `Created: ${formatPdfDate(data.createdAt)}`,
  ];
  doc.text(summaryParts.join("   |   "), margin + 4, y + 13);
  y += 23;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: Customer & Contact Information
  // ═══════════════════════════════════════════════════════════════════════════
  if (y > safeBottom - 10) { doc.addPage(); y = margin + 5; }
  y = sectionHeader(doc, y, contentW, "1. Customer & Contact Information");

  const cust = data.customer;
  const lead = data.lead;
  const contact = data.contact;
  const detail = data.detail;

  y = renderGridRow(doc, [
    { label: "Company Name", value: detail?.companyName || cust?.name || lead?.companyName || "—" },
    { label: "Customer Code", value: cust?.customerCode || "—" },
    { label: "Contact Person", value: detail?.contactPerson || contact?.name || lead?.name || "—" },
    { label: "Designation", value: contact?.designation || lead?.designation || "—" },
    { label: "Email", value: detail?.email || contact?.email || cust?.email || lead?.email || "—" },
    { label: "Phone", value: detail?.phone || contact?.phone || cust?.phone || lead?.phone || "—" },
    { label: "Industry", value: detail?.industry || cust?.industryType || lead?.industryType || "—" },
    { label: "City", value: cust?.city || lead?.city || "—" },
    { label: "Lead Source", value: lead?.leadSource || "—" },
    { label: "Employee Count", value: detail?.employeeCount != null ? String(detail.employeeCount) : "—" },
  ], margin, y, contentW, 2);
  y += 4;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: Business Requirements
  // ═══════════════════════════════════════════════════════════════════════════
  if (y > safeBottom - 10) { doc.addPage(); y = margin + 5; }
  y = sectionHeader(doc, y, contentW, "2. Business Requirements");

  y = textBlock(doc, "Current Challenges", detail?.currentChallenges || "", margin, y, contentW);
  y = textBlock(doc, "Business Need", detail?.businessNeed || lead?.notes || "", margin, y, contentW);
  y = textBlock(doc, "Expected Outcome", detail?.expectedOutcome || "", margin, y, contentW);

  y = renderGridRow(doc, [
    { label: "Urgency / Priority", value: detail?.urgencyPriority || "—" },
    { label: "Expected Go-Live", value: formatPdfDate(detail?.expectedGoLive) },
  ], margin, y, contentW, 2);

  y = textBlock(doc, "Pain Points", detail?.painPoints || "", margin, y, contentW);
  y = textBlock(doc, "Required Features", detail?.requiredFeatures || "", margin, y, contentW);
  y = textBlock(doc, "Business Goals", detail?.businessGoals || "", margin, y, contentW);
  y = textBlock(doc, "Next Steps", detail?.nextSteps || "", margin, y, contentW);
  y += 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: Commercial Information
  // ═══════════════════════════════════════════════════════════════════════════
  if (y > safeBottom - 10) { doc.addPage(); y = margin + 5; }
  y = sectionHeader(doc, y, contentW, "3. Commercial Information");

  y = renderGridRow(doc, [
    { label: "Budget Range", value: detail?.budgetRange || lead?.budgetAsked || "—" },
    { label: "Expected Budget", value: formatCurrency(detail?.expectedBudget ?? lead?.estimatedValue ?? null, { decimals: 0 }) },
    { label: "Final Discussed Budget", value: formatCurrency(detail?.finalDiscussedBudget ?? null, { decimals: 0 }) },
    { label: "Timeline", value: detail?.timeline || lead?.timelineAsked || "—" },
    { label: "Decision Maker", value: detail?.decisionMaker || lead?.name || "—" },
    { label: "Influencer", value: detail?.influencer || "—" },
    { label: "Budget Owner", value: detail?.budgetOwner || "—" },
    { label: "Procurement Process", value: detail?.procurementProcess || "—" },
    { label: "Current Vendor", value: detail?.currentVendor || "—" },
    { label: "Competitors Evaluated", value: detail?.competitorsEvaluated || "—" },
  ], margin, y, contentW, 2);

  if (detail?.objections) y = textBlock(doc, "Objections Raised", detail.objections, margin, y, contentW);
  if (detail?.internalSalesNotes) y = textBlock(doc, "Internal Sales Notes", detail.internalSalesNotes, margin, y, contentW);
  if (detail?.presalesNotes) y = textBlock(doc, "Pre-Sales Notes", detail.presalesNotes, margin, y, contentW);
  y += 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: Demo / Meeting Summary
  // ═══════════════════════════════════════════════════════════════════════════
  if (y > safeBottom - 10) {
    doc.addPage();
    y = margin + 5;
  }
  y = sectionHeader(doc, y, contentW, "4. Demo / Meeting Summary");

  if (data.meetingLogs.length === 0) {
    if (y > safeBottom - 10) {
      doc.addPage();
      y = margin + 5;
    }
    doc.setFontSize(9);
    setFont(doc, "italic");
    doc.setTextColor(...PdfColors.slate400);
    doc.text("No meeting/demo logs recorded.", margin, y);
    y += 8;
  } else {
    data.meetingLogs.forEach((m, idx) => {
      y = meetingCard(doc, m, idx, margin, y, contentW);
    });
  }

  // ── Signature area ──
  if (y > safeBottom - 42) {
    doc.addPage();
    y = margin + 5;
  }
  y += 6;

  doc.setDrawColor(...PdfColors.slate200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 60, y);
  doc.line(pageW - margin - 60, y, pageW - margin, y);
  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(...PdfColors.slate500);
  doc.text("Sales Representative", margin + 30, y + 4, { align: "center" });
  doc.text("Customer Acknowledgement", pageW - margin - 30, y + 4, { align: "center" });

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, {
      center: `${companyName} — Requirements Summary · ${data.opportunityCode}`,
      page: i,
    });
  }

  return doc;
}
