import { jsPDF } from "jspdf";
import * as fs from "fs";
import * as path from "path";

// ─── Color palette used across all CRM PDF exports ────────────────────────────
export const PdfColors = {
  primary: [30, 64, 175] as [number, number, number],    // #1e40af
  primaryDark: [30, 41, 59] as [number, number, number],   // #1e293b
  slate500: [100, 116, 139] as [number, number, number], // #64748b
  slate600: [71, 85, 105] as [number, number, number],   // #475569
  slate400: [148, 163, 184] as [number, number, number], // #94a3b8
  slate200: [226, 232, 240] as [number, number, number], // #e2e8f0
  slate100: [241, 245, 249] as [number, number, number],   // #f1f5f9
  slate50: [248, 250, 252] as [number, number, number],   // #f8fafc
  white: [255, 255, 255] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],        // #dc2626
};

const FONT_REGULAR = "NotoSans";
const FONT_BOLD = "NotoSans";

function loadFontBinary(fileName: string): string {
  // Allow override via env for CI/containers where system fonts may differ
  const overrideDir = process.env.PDF_FONTS_DIR;
  const candidates = overrideDir ? [overrideDir] : [];
  candidates.push(
    path.join(process.cwd(), "public", "fonts"),
    "/usr/share/fonts/truetype/noto",
    "/usr/share/fonts/truetype/dejavu",
  );

  for (const dir of candidates) {
    const p = path.join(dir, fileName);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p).toString("binary");
    }
  }
  throw new Error(`PDF font not found: ${fileName}. Run with PDF_FONTS_DIR set or install Noto Sans fonts.`);
}

/**
 * Register Unicode-safe Noto Sans fonts with jsPDF so symbols like ₹ render
 * correctly. Should be called immediately after creating the jsPDF instance.
 */
export function setupPdfFonts(doc: jsPDF): void {
  // Fonts must be registered on every jsPDF instance; they are not shared across instances.
  const regular = loadFontBinary("NotoSans-Regular.ttf");
  doc.addFileToVFS("NotoSans-Regular.ttf", regular);
  doc.addFont("NotoSans-Regular.ttf", FONT_REGULAR, "normal");

  const bold = loadFontBinary("NotoSans-Bold.ttf");
  doc.addFileToVFS("NotoSans-Bold.ttf", bold);
  doc.addFont("NotoSans-Bold.ttf", FONT_BOLD, "bold");

  doc.setFont(FONT_REGULAR, "normal");
}

export function setFont(doc: jsPDF, style: "normal" | "bold" | "italic" | "bolditalic" = "normal"): void {
  doc.setFont(FONT_REGULAR, style);
}

// ─── Currency formatting ─────────────────────────────────────────────────────
const CURRENCY_FORMATTER_2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CURRENCY_FORMATTER_0 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format an amount as "₹X,XX,XXX.XX" using the shared Unicode-safe font.
 * Returns "—" for null/undefined amounts.
 */
export function formatCurrency(amount: number | null | undefined, { decimals = 2 }: { decimals?: number } = {}): string {
  if (amount == null) return "—";
  const formatter = decimals === 0 ? CURRENCY_FORMATTER_0 : CURRENCY_FORMATTER_2;
  return `₹${formatter.format(amount)}`;
}

/**
 * Format a date as "DD MMM YYYY".
 */
export function formatPdfDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Draw a horizontal divider line across the content width.
 */
export function drawDivider(doc: jsPDF, y: number, color: [number, number, number] = PdfColors.slate200, width = 0.3): void {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(margin, y, pageW - margin, y);
}

/**
 * Common page footer for document-family consistency.
 */
export function addPageFooter(
  doc: jsPDF,
  opts: {
    left?: string;
    center?: string;
    right?: string;
    page?: number;
    lineY?: number;
  } = {},
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const footerY = doc.internal.pageSize.getHeight() - 8;

  doc.setDrawColor(...PdfColors.slate200);
  doc.setLineWidth(0.3);
  const lineY = opts.lineY ?? footerY - 4;
  doc.line(margin, lineY, pageW - margin, lineY);

  doc.setFontSize(7);
  setFont(doc, "normal");
  doc.setTextColor(...PdfColors.slate400);

  if (opts.left) doc.text(opts.left, margin, footerY);
  if (opts.center) doc.text(opts.center, pageW / 2, footerY, { align: "center" });
  if (opts.right) doc.text(opts.right, pageW - margin, footerY, { align: "right" });
  if (opts.page != null) {
    doc.text(`Page ${opts.page}`, pageW - margin, footerY, { align: "right" });
  }
}

/**
 * Add a professional document header with company name, address/contact, badge,
 * and optional document code / meta.
 */
export function addDocumentHeader(
  doc: jsPDF,
  opts: {
    companyName: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    badgeText: string;
    docCode: string;
    metaLines?: string[];
    companyGstin?: string;
  },
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - 2 * margin;
  let y = margin;

  // Badge (right) — draw first so long company names can stop before it
  const badgeW = Math.max(36, doc.getTextWidth(opts.badgeText) + 10);
  const badgeX = pageW - margin - badgeW;
  doc.setFillColor(...PdfColors.primary);
  doc.roundedRect(badgeX, margin - 2, badgeW, 8, 1.5, 1.5, "F");
  doc.setFontSize(10);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.white);
  doc.text(opts.badgeText, badgeX + badgeW / 2, margin + 3.5, { align: "center" });

  // Company name — wrap to fit before badge
  doc.setFontSize(18);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.primary);
  const maxNameW = badgeX - margin - 5;
  const nameLines = doc.splitTextToSize(opts.companyName, maxNameW);
  doc.text(nameLines, margin, y);
  y += 4 + (nameLines.length - 1) * 6;

  // Address / contact
  setFont(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PdfColors.slate400);
  if (opts.companyAddress) {
    const addrLines = doc.splitTextToSize(opts.companyAddress, contentW * 0.58);
    doc.text(addrLines, margin, y);
    y += addrLines.length * 3.5;
  }
  const contactParts: string[] = [];
  if (opts.companyGstin) contactParts.push(`GSTIN: ${opts.companyGstin}`);
  if (opts.companyPhone) contactParts.push(opts.companyPhone);
  if (opts.companyEmail) contactParts.push(opts.companyEmail);
  if (contactParts.length > 0) {
    doc.text(contactParts.join("  |  "), margin, y);
    y += 3.5;
  }

  // Right-side meta lines
  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(...PdfColors.slate500);
  let metaY = margin + 10;
  doc.setFontSize(12);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.primaryDark);
  doc.text(opts.docCode, pageW - margin, metaY, { align: "right" });
  metaY += 5;

  doc.setFontSize(8);
  setFont(doc, "normal");
  doc.setTextColor(...PdfColors.slate500);
  for (const line of opts.metaLines || []) {
    doc.text(line, pageW - margin, metaY, { align: "right" });
    metaY += 3.8;
  }

  y = Math.max(y, metaY) + 3;

  // Divider
  doc.setDrawColor(...PdfColors.primary);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  return y;
}
