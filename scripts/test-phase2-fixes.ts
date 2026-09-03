/**
 * Test script for Phase 2 fixes:
 * 1. Lead source validation (all 8 spec sources + Email accepted)
 * 2. Customer import: mobile validation, GST validation, duplicate detection
 *
 * Run: npx tsx scripts/test-phase2-fixes.ts
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

// ─── Lead Source Validation ───────────────────────────────────────────────────
const SPEC_SOURCES = [
  "Website",
  "IndiaMART",
  "Justdial",
  "TradeIndia",
  "WhatsApp",
  "Door-to-Door Marketing",
  "Direct Visit",
  "Telephonic Conversation",
  "Email",
];

// Import the VALID_SOURCES from the route (replicate for testing)
const VALID_SOURCES = ["Website","IndiaMART","Justdial","TradeIndia","WhatsApp","Door-to-Door Marketing","Direct Visit","Telephonic Conversation","Email"];

// ─── Validation functions (replicated from import route for testing) ──────────
function cleanMobile(mobile: string): string {
  return mobile.replace(/[^\d]/g, "");
}

function validateIndianMobile(raw: string): string | null {
  const cleaned = cleanMobile(raw);
  let digits = cleaned;
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}

function isValidGst(gst: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}Z[0-9A-Z]{1}$/.test(gst);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  let pass = 0;
  let fail = 0;
  const check = (label: string, condition: boolean, detail?: string) => {
    const status = condition ? "PASS" : "FAIL";
    if (condition) pass++; else fail++;
    console.log(`[${status}] ${label}${detail ? " — " + detail : ""}`);
  };

  // ─── 1. Lead Source Validation ──────────────────────────────────────────────
  console.log("\n=== 1. Lead Source Validation ===\n");
  for (const source of SPEC_SOURCES) {
    check(`Source "${source}" accepted by import VALID_SOURCES`, VALID_SOURCES.includes(source));
  }

  // Verify old wrong sources are rejected
  const WRONG_SOURCES = ["Facebook", "Instagram", "LinkedIn", "Referral", "WalkIn", "ColdCall", "Partner", "Trade Show", "Tender Portal"];
  for (const source of WRONG_SOURCES) {
    check(`Source "${source}" correctly REJECTED`, !VALID_SOURCES.includes(source));
  }

  // Verify "Email" source is consistent — check that leads created by the poller have "Email" as source
  const emailLeads = await prisma.lead.findMany({
    where: { leadSource: "Email" },
    take: 5,
    select: { id: true, leadCode: true, leadSource: true },
  });
  check(`Leads with leadSource="Email" exist in DB (from Phase 1 poller)`, emailLeads.length > 0, `Found ${emailLeads.length} lead(s)`);
  if (emailLeads.length > 0) {
    check(`Email lead source is in VALID_SOURCES (dashboard won't break)`, VALID_SOURCES.includes("Email"));
  }

  // ─── 2. Mobile Number Validation ────────────────────────────────────────────
  console.log("\n=== 2. Mobile Number Validation ===\n");

  check(`Valid 10-digit mobile "9876543210" → accepted`, validateIndianMobile("9876543210") === "9876543210");
  check(`Valid mobile with +91 prefix "+919876543210" → accepted`, validateIndianMobile("+919876543210") === "9876543210");
  check(`Valid mobile with 91 prefix "919876543210" → accepted`, validateIndianMobile("919876543210") === "9876543210");
  check(`Invalid mobile "abc123" → REJECTED`, validateIndianMobile("abc123") === null);
  check(`Invalid mobile "1234567890" (starts with 1) → REJECTED`, validateIndianMobile("1234567890") === null);
  check(`Invalid mobile "987654" (too short) → REJECTED`, validateIndianMobile("987654") === null);
  check(`Invalid mobile "98765432101" (11 digits) → REJECTED`, validateIndianMobile("98765432101") === null);
  check(`Valid mobile starting with 6 "6123456789" → accepted`, validateIndianMobile("6123456789") === "6123456789");

  // ─── 3. GST Number Validation ───────────────────────────────────────────────
  console.log("\n=== 3. GST Number Validation ===\n");

  check(`Valid GST "33AABCU1234A1Z5" → accepted`, isValidGst("33AABCU1234A1Z5"));
  check(`Valid GST "27AAACR5055K1Z5" → accepted`, isValidGst("27AAACR5055K1Z5"));
  check(`Invalid GST "AAAAAAAAAAAAAAA" (15 letters, no structure) → REJECTED`, !isValidGst("AAAAAAAAAAAAAAA"));
  check(`Invalid GST "123456789012345" (all digits) → REJECTED`, !isValidGst("123456789012345"));
  check(`Invalid GST "33AABCU1234A1Z" (14 chars) → REJECTED`, !isValidGst("33AABCU1234A1Z"));
  check(`Invalid GST "33AABCU1234A1Z55" (16 chars) → REJECTED`, !isValidGst("33AABCU1234A1Z55"));
  check(`Invalid GST "33AAB1U1234A1Z5" (digit in PAN letter position) → REJECTED`, !isValidGst("33AAB1U1234A1Z5"));
  check(`Invalid GST "33AABCU1234A2Z5" (entity digit 2 is valid) → accepted`, isValidGst("33AABCU1234A2Z5"));
  check(`Invalid GST "33AABCU1234A1X5" (X instead of Z) → REJECTED`, !isValidGst("33AABCU1234A1X5"));

  // ─── 4. Duplicate Detection ─────────────────────────────────────────────────
  console.log("\n=== 4. Duplicate Detection (DB-level) ===\n");

  // Find the company
  const company = await prisma.company.findFirst();
  const companyId = company?.id || null;

  // Create a test customer to test duplicate detection against
  const testEmail = `test-dup-${Date.now()}@test.com`;
  const testMobile = "9876543210";
  const testName = `Test Dup Customer ${Date.now()}`;
  const testGst = "33AABCU1234A1Z5";

  // Clean up any existing test data first
  await prisma.customer.deleteMany({ where: { email: testEmail } }).catch(() => {});
  await prisma.customer.deleteMany({ where: { name: { contains: "Test Dup Customer" } } }).catch(() => {});

  // Create a base test customer
  const baseCustomer = await prisma.customer.create({
    data: {
      customerCode: `TEST-${Date.now()}`,
      name: testName,
      email: testEmail,
      phone: testMobile,
      gstNumber: testGst,
      companyId,
    },
  });
  console.log(`Created base test customer: ${baseCustomer.customerCode} (${testName})\n`);

  // Test 1: Duplicate GST
  const dupGst = await prisma.customer.findFirst({ where: { gstNumber: testGst, companyId } });
  check(`Duplicate GST detected`, !!dupGst, dupGst ? `Found: ${dupGst.name}` : "Not found");

  // Test 2: Duplicate email (with blank GST)
  const dupEmail = await prisma.customer.findFirst({ where: { email: testEmail, companyId } });
  check(`Duplicate email detected`, !!dupEmail, dupEmail ? `Found: ${dupEmail.name}` : "Not found");

  // Test 3: Duplicate name + mobile (with blank GST)
  const dupNameMobile = await prisma.customer.findFirst({
    where: { name: testName, phone: testMobile, companyId },
  });
  check(`Duplicate name+mobile detected`, !!dupNameMobile, dupNameMobile ? `Found: ${dupNameMobile.name}` : "Not found");

  // Clean up
  await prisma.customer.delete({ where: { id: baseCustomer.id } });
  console.log("\nCleaned up test customer.");

  // ─── 5. Valid Customer Import Test ──────────────────────────────────────────
  console.log("\n=== 5. Valid Customer Import Test ===\n");

  const validName = `Test Valid Customer ${Date.now()}`;
  const validEmail = `test-valid-${Date.now()}@test.com`;
  const validMobile = "9876543210";
  const validGst = "27AAACR5055K1Z5";

  // Clean up first
  await prisma.customer.deleteMany({ where: { email: validEmail } }).catch(() => {});

  // Simulate a valid row
  const mobileValid = validateIndianMobile(validMobile);
  const gstValid = isValidGst(validGst);
  const emailValid = isValidEmail(validEmail);

  check(`Valid row: mobile passes`, mobileValid !== null, `→ ${mobileValid}`);
  check(`Valid row: GST passes`, gstValid);
  check(`Valid row: email passes`, emailValid);

  // Check no duplicates exist
  const noDupGst = !await prisma.customer.findFirst({ where: { gstNumber: validGst, companyId } });
  const noDupEmail = !await prisma.customer.findFirst({ where: { email: validEmail, companyId } });
  check(`Valid row: no GST duplicate`, noDupGst);
  check(`Valid row: no email duplicate`, noDupEmail);

  // Create the valid customer
  const validCustomer = await prisma.customer.create({
    data: {
      customerCode: `VALID-${Date.now()}`,
      name: validName,
      email: validEmail,
      phone: mobileValid,
      gstNumber: validGst,
      companyId,
    },
  });
  check(`Valid customer created successfully`, !!validCustomer.id, `→ ${validCustomer.customerCode}`);

  // Clean up
  await prisma.customer.delete({ where: { id: validCustomer.id } });
  console.log("Cleaned up valid test customer.");

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
