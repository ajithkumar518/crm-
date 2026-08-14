import { writeFileSync } from "fs";
import { generateSukiQuotationPdf, SukiQuotationPdfData } from "../lib/generateSukiQuotationPdf";

const sampleData: SukiQuotationPdfData = {
  quotationCode: "QT-2026-00001",
  revisionNumber: 1,
  status: "Quotation Sent",
  validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  termsAndConditions: `Cutting Charges – Extra\nWeighing & Loading Charges – Rs. 350/- per Ton\nDelivery Charges – Extra\nTesting Charges – Extra\nQuotation Validity – Immediate\nTaxes – Extra\nRejection Clause – Material will be accepted only in the supplied condition.\nWeighment Tolerance – ±5 Kgs per MT.\nNote: Clerical errors, if any, are subject to correction.`,
  paymentTerms: "50% advance, balance before dispatch",
  deliveryTerms: "Ex-Works",
  freightTerms: "Extra at actuals",
  leadTimeDays: 15,
  customer: {
    name: "ABC Engineering Works",
    customerCode: "CUS-00001",
    billingAddress: "12/3 Industrial Estate, Chennai",
    city: "Chennai",
    gstNumber: "33AABCU1234A1Z5",
    phone: "+91-98765-43210",
    email: "purchase@abcengg.com",
  },
  contact: { name: "Mr. Ramesh", phone: "+91-98765-43210", email: "ramesh@abcengg.com" },
  company: { name: "SUKI Steel Traders" },
  companyAddress: "No. 45, SIDCO Estate, Guindy, Chennai - 600032",
  companyGstin: "33AACFS1234A1Z5",
  companyPhone: "+91-44-1234-5678",
  companyEmail: "sales@sukisteel.com",
  generatedByName: "Shahnaz",
  items: [
    {
      description: "Alloy Steel Round Bar",
      productType: "Black Bar",
      materialGrade: "EN19",
      materialSize: "50mm",
      rmMake: "Tata Steel",
      length: 3000,
      numberOfPieces: 10,
      quantity: 80,
      unit: "kgs",
      unitPrice: 650,
      discountPercent: 2,
      taxPercent: 18,
      hsn: "7228",
      cuttingCharge: 0,
      remarks: "NON VD",
    },
    {
      description: "Die Steel Flat",
      productType: "Bright Bar",
      materialGrade: "D2",
      materialSize: "25mm",
      rmMake: "SAIL",
      length: 6000,
      numberOfPieces: 5,
      quantity: 40,
      unit: "kgs",
      unitPrice: 850,
      discountPercent: 0,
      taxPercent: 18,
      hsn: "7228",
      cuttingCharge: 0,
      remarks: "VD",
    },
  ],
};

const doc = generateSukiQuotationPdf(sampleData);
const buf = doc.output("arraybuffer");
writeFileSync("D:\\SHAHNAZ_CRM\\suki_crm\\public\\quotation-template-preview.pdf", Buffer.from(buf));
console.log("Preview saved to public/quotation-template-preview.pdf");
