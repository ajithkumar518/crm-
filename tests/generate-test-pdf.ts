import { generateSukiProformaInvoicePdf } from "../lib/generateSukiProformaInvoicePdf";
import fs from "fs";
import path from "path";

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
    address: "No:1,Plot No.52A,52B,No.102,Mugappair Road, Padi,Chennai,Tamil Nadu - 600050, India",
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
    }
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
  subtotal: 15580,
  taxAmount: 2804.4,
  grandTotal: 18685.4,
  roundedOff: 0,
  paymentTerms: "Advance",
  placeOfSupply: "Tamil Nadu",
  state: "Tamil Nadu",
  stateCode: "33",
  vehicleNo: "NEED TO UPDATE",
  preparedBy: "SUBASHINI",
  irn: "",
  ackNo: "",
  ewayBillNo: "",
};

const doc = generateSukiProformaInvoicePdf(baseData);
const buf = Buffer.from(doc.output("arraybuffer"));
const outPath = path.join(process.cwd(), "test-proforma-output.pdf");
fs.writeFileSync(outPath, buf);
console.log(`Generated PDF at ${outPath}`);
