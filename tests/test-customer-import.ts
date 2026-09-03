/**
 * Unit test the customer-master import logic (re-implementation to avoid auth).
 * Tests required fields, state validation, lead source normalization, and
 * that all columns are mapped.
 */
import ExcelJS from "exceljs";

const VALID_STATUSES = ["Prospect", "ActiveCustomer", "Renewed", "Churned"];
const VALID_LEAD_SOURCES = [
  "Website", "IndiaMART", "Justdial", "TradeIndia", "WhatsApp",
  "Door-to-Door Marketing", "Direct Visit", "Telephonic Conversation", "Email",
];
const VALID_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

const CUSTOMER_HEADERS: Record<string, string> = {
  "customer name": "name",
  "name": "name",
  "email id": "email",
  "email": "email",
  "mobile number": "mobile",
  "mobile": "mobile",
  "phone": "mobile",
  "city": "city",
  "location": "location",
  "status": "status",
  "lead source": "leadSource",
  "assign to executive": "marketingExecutive",
  "marketing executive": "marketingExecutive",
  "assigned executive": "marketingExecutive",
  "gst number": "gstNumber",
  "gstin": "gstNumber",
  "customer category": "customerCategory",
  "state": "state",
  "industry type": "industryType",
  "payment terms": "paymentTerms",
  "credit days": "creditDays",
  "billing address": "billingAddress",
  "address": "billingAddress",
  "shipping address": "shippingAddress",
  "contact person": "contactPerson",
  "contact mobile": "contactMobile",
  "contact email": "contactEmail",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim();
}
function normalizeState(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  return VALID_STATES.find((s) => s.toLowerCase() === v.toLowerCase()) || null;
}
function normalizeLeadSource(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  return VALID_LEAD_SOURCES.find((s) => s.toLowerCase() === v.toLowerCase()) || null;
}

function validateRow(row: Record<string, any>): { errors: string[]; normalized: any } {
  const errors: string[] = [];
  const name = String(row.name ?? "").trim();
  const leadSourceRaw = String(row.leadSource ?? "").trim() || null;
  const stateRaw = String(row.state ?? "").trim() || null;

  if (!name) errors.push("Customer Name is required");
  if (!leadSourceRaw) errors.push("Lead Source is required");
  if (!stateRaw) errors.push("State is required (required for GST tax type determination)");

  const state = normalizeState(stateRaw);
  const leadSource = normalizeLeadSource(leadSourceRaw);

  if (leadSourceRaw && !leadSource) errors.push(`Lead Source "${leadSourceRaw}" is not valid.`);
  if (stateRaw && !state) errors.push(`State "${stateRaw}" is not valid.`);

  return {
    errors,
    normalized: { name, leadSource, state, city: row.city, location: row.location },
  };
}

async function main() {
  const tests: { name: string; row: Record<string, any>; expectErrors: number }[] = [
    { name: "Missing required fields", row: { name: "" }, expectErrors: 3 },
    { name: "Invalid state", row: { name: "Test", leadSource: "IndiaMART", state: "Taminadu" }, expectErrors: 1 },
    { name: "Invalid lead source", row: { name: "Test", leadSource: "Facebook", state: "Tamil Nadu" }, expectErrors: 1 },
    { name: "Valid row", row: { name: "Test", leadSource: "IndiaMART", state: "Tamil Nadu", city: "Chennai", location: "No. 45, Anna Salai" }, expectErrors: 0 },
  ];

  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    const { errors } = validateRow(t.row);
    const ok = errors.length === t.expectErrors;
    console.log(`[${ok ? "PASS" : "FAIL"}] ${t.name}: got ${errors.length} error(s), expected ${t.expectErrors}. ${errors.join("; ")}`);
    if (ok) passed++; else failed++;
  }

  // Test full column set in workbook
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Customer Master");
  const headers = [
    "Customer Name*", "Email ID", "Mobile Number", "City", "Location", "Status",
    "Lead Source*", "Assign to Executive", "GST Number", "Customer Category",
    "State*", "Industry Type", "Payment Terms", "Credit Days", "Billing Address",
    "Shipping Address", "Contact Person", "Contact Mobile", "Contact Email",
  ];
  sheet.addRow(headers);
  const headerMap: Record<number, string> = {};
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const key = CUSTOMER_HEADERS[normalizeHeader(cell.value)];
    if (key) headerMap[colNumber] = key;
  });
  const mapped = Object.values(headerMap);
  const expectedMapped = [
    "name", "email", "mobile", "city", "location", "status", "leadSource",
    "marketingExecutive", "gstNumber", "customerCategory", "state", "industryType",
    "paymentTerms", "creditDays", "billingAddress", "shippingAddress", "contactPerson",
    "contactMobile", "contactEmail",
  ];
  const allColumnsMapped = expectedMapped.every((k) => mapped.includes(k));
  console.log(`[${allColumnsMapped ? "PASS" : "FAIL"}] All expected import columns are mapped: ${mapped.join(", ")}`);
  if (allColumnsMapped) passed++; else failed++;

  console.log(`\nRESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
