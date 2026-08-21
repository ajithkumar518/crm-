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

  const computed = computeTotals(data);

  for (let i = 0; i < copies.length; i++) {
    if (i > 0) doc.addPage();
    drawPage(doc, data, computed, copies[i], i + 1, copies.length);
  }

  return doc;
}

function computeTotals(data: SukiProformaInvoiceData) {
  const totalItemTaxable = data.items.reduce((s, it) => s + it.taxable, 0);
  const totalQty = data.items.reduce((s, it) => s + it.quantity, 0);
  const totalPcs = data.items.reduce((s, it) => s + (it.numberOfPieces || 0), 0);

  const hsnMap = new Map<string, { taxable: number; taxPercent: number; tax: number }>();
  for (const it of data.items) {
    const hsn = it.hsn || "—";
    const taxPct = it.taxPercent || 18;
    const existing = hsnMap.get(hsn);
    if (existing) {
      existing.taxable += it.taxable;
    } else {
      hsnMap.set(hsn, { taxable: it.taxable, taxPercent: taxPct, tax: 0 });
    }
  }

  const hsnRows: { hsn: string; taxable: number; taxPercent: number; tax: number }[] = [];
  let totalHsnTaxable = 0;
  let totalHsnTax = 0;
  for (const [hsn, row] of hsnMap) {
    row.tax = row.taxable * (row.taxPercent / 100);
    hsnRows.push({ hsn, taxable: row.taxable, taxPercent: row.taxPercent, tax: row.tax });
    totalHsnTaxable += row.taxable;
    totalHsnTax += row.tax;
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
    hsnRows.push({ hsn: "996111", taxable: serviceTaxable, taxPercent: serviceTaxPercent, tax: serviceTax });
    totalHsnTaxable += serviceTaxable;
    totalHsnTax += serviceTax;
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
    serviceTaxable,
    serviceTax,
    rawTotal,
    roundedOff: rounded,
  };
}

function drawPage(doc: jsPDF, data: SukiProformaInvoiceData, c: ReturnType<typeof computeTotals>, copyType: string, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - 2 * margin;
  let y = margin;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(margin, margin, contentW, pageH - 2 * margin);

  // Copy label
  doc.setFontSize(9);
  setFont(doc, "bold");
  doc.setTextColor(...PdfColors.primary);
  doc.text(copyType, pageW - margin - 2, y + 4, { align: "right" });

  // Title
  doc.setFontSize(14);
  setFont(doc, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("PRO-FORMA INVOICE", pageW / 2, y + 4, { align: "center" });
  y += 8;

  // Company banner
  doc.setFontSize(13);
  setFont(doc, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(data.company?.name || "Shahnaz Bright Steel Industries Private Limited", pageW / 2, y, { align: "center" });
  y += 5;

  // Company details block
  const halfW = (contentW - 6) / 2;
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
  const centerX = rightX + availWidth / 2;
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

  let cy = y;
  for (const line of companyLines) {
    if (!line) continue;
    const wrapped = doc.splitTextToSize(line, availWidth);
    doc.text(wrapped, centerX, cy, { align: "center" });
    cy += wrapped.length * 3.5 + 0.5;
  }
  y = Math.max(y + logoH + 2, cy + 0.5);

  // Meta strip
  y = drawMetaStrip(doc, data, margin, y, contentW);

  // Customer blocks
  y = drawCustomerBlocks(doc, data, margin, y, contentW);

  // Items table
  y = drawItemsTable(doc, data, c, margin, y, contentW);

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

  // Signature block
  y = drawSignatureBlock(doc, data, margin, y, contentW);

  // Footer
  doc.setFontSize(7);
  setFont(doc, "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("This is a Computer Generated Invoice", pageW / 2, pageH - margin - 6, { align: "center" });

  const footerY = pageH - margin - 3;
  doc.setFontSize(7);
  doc.text("Suki CRM", pageW / 2, footerY, { align: "center" });
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin - 2, footerY, { align: "right" });
}

function drawMetaStrip(doc: jsPDF, data: SukiProformaInvoiceData, x: number, y: number, w: number): number {
  const leftColX = x + 3;
  const midX = x + w / 2;
  const rightColX = midX + 3;
  const lineH = 3.5;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  const leftPairs = [
    ["IRN No", data.irn || ""],
    ["Ack No", data.ackNo || ""],
    ["Ack Dt", data.ackDate ? formatPdfDate(data.ackDate) : ""],
    ["Eway Bill No", data.ewayBillNo || ""],
    ["Eway Bill Dt", data.ewayBillDate ? formatPdfDate(data.ewayBillDate) : ""],
  ];

  const rightPairs = [
    ["Invoice No.", data.proformaNumber],
    ["Invoice Date", data.proformaDate ? formatPdfDate(data.proformaDate) : "—"],
    ["Customer PO No.", data.customerPoNo || ""],
    ["Customer PO Date", data.customerPoDate ? formatPdfDate(data.customerPoDate) : ""],
    ["Despatch Through", data.despatchThrough || ""],
    ["State", data.stateCode ? `${data.placeOfSupply || data.state || "—"}  State Code : ${data.stateCode}` : `${data.placeOfSupply || data.state || "—"}`],
    ["Place of Supply", data.placeOfSupply || ""],
    ["Payment Terms", data.paymentTerms || ""],
    ["Vehicle No", data.vehicleNo || ""],
  ];

  let ly = y + 5;
  for (const [label, value] of leftPairs) {
    doc.setFontSize(7);
    setFont(doc, "bold");
    const labelText = `${label} :`;
    doc.text(labelText, leftColX, ly);
    const labelW = doc.getTextWidth(labelText + " ");
    setFont(doc, "normal");
    doc.text(value || "—", leftColX + labelW, ly);
    ly += lineH;
  }

  let ry = y + 5;
  for (const [label, value] of rightPairs) {
    doc.setFontSize(7);
    setFont(doc, "bold");
    const labelText = `${label} :`;
    doc.text(labelText, rightColX, ry);
    const labelW = doc.getTextWidth(labelText + " ");
    setFont(doc, "normal");
    doc.text(value || "—", rightColX + labelW, ry);
    ry += lineH;
  }

  const h = Math.max(ly, ry) - y + 2;
  doc.rect(x, y, w, h);
  doc.line(midX - 1, y, midX - 1, y + h);

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
    { title: "Details of Customer (Bill To)", name: billName, address: billAddress, state: billState, gst: billGst, phone: billPhone, x: x + 2, stateCode: data.billStateCode },
    { title: "Details of Customer (Ship To)", name: shipName, address: shipAddress, state: shipState, gst: shipGst, phone: shipPhone, x: x + halfW + 4, stateCode: data.shipStateCode },
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
      ["State", b.state ? `${b.state}  State Code : ${b.stateCode || ""}` : "—"],
      ["GST No", b.gst || "—"],
      ["Phone No", b.phone || "—"],
    ];

    for (const [label, value] of lines) {
      doc.setFontSize(7);
      setFont(doc, "bold");
      doc.text(`${label} :`, b.x, by);
      setFont(doc, "normal");
      const wrapped = doc.splitTextToSize(value || "—", halfW - labelW - 8);
      doc.text(wrapped, b.x + labelW, by);
      by += Math.max(3.0, wrapped.length * 3.0);
    }
    blockEndY = Math.max(blockEndY, by);
  }

  const h = blockEndY - y + 4;
  doc.rect(x, y, w, h);
  doc.line(x + halfW + 2, y, x + halfW + 2, y + h);

  return y + h + 2;
}

function drawItemsTable(doc: jsPDF, data: SukiProformaInvoiceData, c: ReturnType<typeof computeTotals>, x: number, y: number, w: number): number {
  const head = [["S.No", "Description of Goods", "Length", "HSN", "Qty", "UOM", "No.of Pcs", "Rate", "Taxable Value"]];

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
    "",
    "",
    formatCurrency(c.totalItemTaxable),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: x, right: x },
    tableWidth: w,
    head,
    body,
    styles: {
      font: "NotoSans",
      fontSize: 7,
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
  });

  return (doc as any).lastAutoTable.finalY + 2;
}

function drawHsnTable(doc: jsPDF, data: SukiProformaInvoiceData, c: ReturnType<typeof computeTotals>, x: number, y: number, w: number): number {
  const head = [["HSN Code", "Taxable Value", "IGST %", "IGST Amt", "Total Tax"]];

  const body = c.hsnRows.map((r) => [
    r.hsn,
    formatCurrency(r.taxable),
    `${r.taxPercent}%`,
    formatCurrency(r.tax),
    formatCurrency(r.tax),
  ]);

  body.push(["Total", formatCurrency(c.totalHsnTaxable), "", formatCurrency(c.totalHsnTax), formatCurrency(c.totalHsnTax)]);

  autoTable(doc, {
    startY: y,
    margin: { left: x, right: x },
    tableWidth: w,
    head,
    body,
    styles: {
      font: "NotoSans",
      fontSize: 7,
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
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right" },
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
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
    doc.setFontSize(7);
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
    ["Transport Charges (Before Tax)", data.charges.transportCharge],
    ["Delivery Charges (Before Tax)", data.charges.deliveryCharge],
    ["Testing Charges (Before Tax)", data.charges.testingCharge],
    ["Other Charges (Before Tax)", data.charges.otherCharges],
    ["Add : IGST", c.totalHsnTax],
    ["Rounded Off(+/-)", c.roundedOff],
    ["Total Amount", data.grandTotal],
  ];

  for (let i = 0; i < chargeRows.length; i++) {
    const [label, value] = chargeRows[i];
    if (i > 0 && i < chargeRows.length - 2 && value === 0) continue; // skip zero charge rows except main rows
    doc.setFontSize(7);
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

  doc.setFontSize(7);
  setFont(doc, "normal");
  doc.text(termsLines, textX, y + 5);

  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text("Declaration :", x + 3, declY);

  doc.setFontSize(7);
  setFont(doc, "normal");
  doc.text(declLines, textX, declY);

  return y + h + 2;
}

function drawSignatureBlock(doc: jsPDF, data: SukiProformaInvoiceData, x: number, y: number, w: number): number {
  const h = 22;
  const col1 = w * 0.18;
  const col2 = w * 0.18;
  const col3 = w * 0.24;
  const col4 = w * 0.40;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.line(x + col1, y, x + col1, y + h);
  doc.line(x + col1 + col2, y, x + col1 + col2, y + h);
  doc.line(x + col1 + col2 + col3, y, x + col1 + col2 + col3, y + h);

  doc.setFontSize(7);
  setFont(doc, "bold");
  doc.text("Prepared By", x + 3, y + 5);
  doc.text("Verified By", x + col1 + 3, y + 5);

  // QR placeholder
  const qrX = x + col1 + col2 + (col3 - 18) / 2;
  const qrY = y + 2;
  doc.setDrawColor(0, 0, 0);
  doc.rect(qrX, qrY, 18, 18);
  doc.setFontSize(7);
  setFont(doc, "normal");
  doc.text("QR", qrX + 9, qrY + 10, { align: "center" });

  const authX = x + col1 + col2 + col3 + 3;
  const companyName = data.company?.name || "Shahnaz Bright Steel Industries Private Limited";
  const forLines = doc.splitTextToSize(`For ${companyName}`, col4 - 6);
  doc.setFontSize(8);
  setFont(doc, "bold");
  doc.text(forLines, authX, y + 5);

  doc.setFontSize(7);
  setFont(doc, "bold");
  doc.text("Authorised Signatory", x + w - 3, y + h - 3, { align: "right" });

  return y + h;
}
