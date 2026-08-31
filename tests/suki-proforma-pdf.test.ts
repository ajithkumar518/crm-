import { strict as assert } from "assert";
import { generateSukiProformaInvoicePdf } from "@/lib/generateSukiProformaInvoicePdf";

function pdfBytesLength(doc: any): number {
  const buf = Buffer.from(doc.output("arraybuffer"));
  return buf.length;
}

function countPages(doc: any): number {
  return doc.internal.getNumberOfPages();
}

const baseData = {
  proformaNumber: "P2/0495/26-27",
  proformaDate: new Date("2026-08-19"),
  customer: {
    name: "ONLOADGEARS EXPORTS INDIA PRIVATE LIMITED",
    billingAddress: "380 Belerica Road, Sri City Dtz,Varadaiahpalem Mandal, Tirupathi-517646",
    shippingAddress: "380 Belerica Road, Sri City Dtz,Varadaiahpalem Mandal, Tirupathi-517646",
    state: "Andhra Pradesh",
    gstNumber: "37AAECO2527M1Z6",
    phone: "9840366886",
  },
  company: {
    name: "Shahnaz Bright Steel Industries Private Limited",
    address: "No.1,Plot No.52A,52B,No.102,Mugappair Road, Padi,Chennai,Tamil Nadu - 600050, India",
    phone: "9363331766, 7845517678",
    gstin: "33ABACS56559E1ZD",
    pan: "ABACS56559E",
    cin: "U28999TN2018PTC123999",
    regOff: "No 327/17A, 17B, 18, 325/2A, 2B, 3, Kuthiraipallam Village, Jagannathapuram Post, Ponneri, Tiruvallur Dist, Chennai-600067",
  },
  items: [
    {
      description: "BRIGHT BAR SAE1018 16.00 MM",
      hsn: "72155010",
      quantity: 205,
      unit: "Kgs",
      numberOfPieces: 42,
      unitPrice: 76,
      taxPercent: 18,
      taxable: 15580,
    },
    {
      description: "BRIGHT BAR SAE1018 8.00 MM",
      hsn: "72155010",
      quantity: 205.2,
      unit: "Kgs",
      numberOfPieces: 1,
      unitPrice: 76,
      taxPercent: 18,
      taxable: 15595.2,
    },
    {
      description: "BRIGHT BAR SAE 1018 40.00 MM",
      hsn: "72155010",
      quantity: 344,
      unit: "Kgs",
      numberOfPieces: 11,
      unitPrice: 76,
      taxPercent: 18,
      taxable: 26144,
    },
  ],
  charges: {
    transportCharge: 0,
    otherCharges: 0,
    weighingLoadingCharge: 301,
    deliveryCharge: 0,
    testingCharge: 0,
  },
  bank: {
    name: "AXIS CA",
    ifsc: "UTIB0004530",
    accountNo: "9220020058966995",
    branch: "PADI BRANCH",
  },
  subtotal: 57342,
  taxAmount: 10375.74,
  grandTotal: 68019.02,
  roundedOff: 0.28,
  paymentTerms: "Advance",
  placeOfSupply: "Tamil Nadu",
  state: "Tamil Nadu",
  stateCode: "33",
  vehicleNo: "NEED TO UPDATE",
  preparedBy: "SUBASHINI",
};

export default function runTests() {
  const doc = generateSukiProformaInvoicePdf(baseData);

  assert.ok(pdfBytesLength(doc) > 0, "PDF should produce non-empty output");
  assert.strictEqual(countPages(doc), 4, "PDF should contain 4 copy pages");

  console.log("SUKI Proforma PDF unit tests passed");
}

if (require.main === module) {
  runTests();
}
