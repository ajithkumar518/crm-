// @ts-nocheck
/**
 * End-to-end test: Send an INTER-STATE quotation (customer in Tamil Nadu,
 * supplier in Kerala) → fetch email from inbox → extract PDF attachment →
 * verify it shows IGST (not CGST+SGST).
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import jwt from "jsonwebtoken";
import { ImapFlow } from "imapflow";
import { writeFileSync } from "fs";
config();
const prisma = new PrismaClient();

const API_BASE = "http://localhost:3000";

async function main() {
  let pass = 0, fail = 0;
  const check = (label: string, condition: boolean, detail?: string) => {
    const status = condition ? "PASS" : "FAIL";
    if (condition) pass++; else fail++;
    console.log(`[${status}] ${label}${detail ? " — " + detail : ""}`);
  };

  const company = await prisma.company.findFirst();
  const adminUser = await prisma.user.findFirst({ where: { role: "Admin", isActive: true, companyId: company?.id }, select: { id: true, email: true, companyId: true } });
  if (!adminUser) { console.log("No admin user"); process.exit(1); }

  // Create a test quotation with an INTER-STATE customer (Tamil Nadu, GSTIN starts with 33)
  const year = new Date().getFullYear();
  const qCount = await prisma.quotation.count({ where: { quotationCode: { startsWith: `QT-IGST-${year}-` } } });
  const qCode = `QT-IGST-${year}-${String(qCount + 1).padStart(5, "0")}`;

  // Find or create a customer in Tamil Nadu with the test Gmail address
  let customer = await prisma.customer.findFirst({ where: { email: "testsuki66@gmail.com", companyId: adminUser.companyId } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        customerCode: `TEST-IGST-${Date.now().toString().slice(-6)}`,
        name: "Inter-State Test Customer TN",
        email: "testsuki66@gmail.com",
        phone: "9876543211",
        city: "Chennai",
        state: "Tamil Nadu",
        billingAddress: "Industrial Estate, Chennai",
        shippingAddress: "Industrial Estate, Chennai",
        gstNumber: "33AABCT5678E1Z5",
        leadSource: "Direct Visit",
        status: "Prospect",
        assignedUserId: adminUser.id,
        companyId: adminUser.companyId,
      },
    });
  } else {
    // Update existing customer to be in Tamil Nadu
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        state: "Tamil Nadu",
        city: "Chennai",
        billingAddress: "Industrial Estate, Chennai",
        shippingAddress: "Industrial Estate, Chennai",
        gstNumber: "33AABCT5678E1Z5",
      },
    });
  }

  const quotation = await prisma.quotation.create({
    data: {
      quotationCode: qCode,
      customerId: customer.id,
      status: "Draft",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 100000,
      taxAmount: 18000,
      discountPercent: 0,
      finalAmount: 118000,
      totalAmount: 100000,
      transportCharge: 100,
      otherCharges: 50,
      termsAndConditions: "Cutting Charges – Extra\nWeighing/Loading Charges – Rs. 350/- per Ton\nDelivery Charges – Extra\nTesting Charges – Extra",
      createdById: adminUser.id,
      companyId: adminUser.companyId,
      items: {
        create: [{
          description: "SS304 Round Bar",
          productType: "Bright Bar",
          rmMake: "SAIL",
          numberOfPieces: 10,
          quantity: 100,
          unitPrice: 1000,
          totalPrice: 100000,
          lineTotal: 100000,
          taxPercent: 18,
          cuttingCharge: 500,
          remarks: "Inter-state email test",
          unit: "kgs",
        }],
      },
    },
    include: { items: true, customer: { select: { email: true, state: true, gstNumber: true } } },
  });

  console.log(`Created inter-state test quotation: ${qCode} (id=${quotation.id})`);
  console.log(`Customer: ${quotation.customer.name || "n/a"}, state=${quotation.customer.state}, GSTIN=${quotation.customer.gstNumber}`);
  console.log(`Customer email: ${quotation.customer.email}`);

  // Generate JWT token
  const JWT_SECRET = process.env.JWT_SECRET!;
  const token = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "Admin", companyId: adminUser.companyId }, JWT_SECRET, { expiresIn: "1h" });
  const cookie = `token=${token}`;

  // Call the send endpoint
  console.log("\n=== Calling POST /api/quotations/[id]/send ===");
  const sendRes = await fetch(`${API_BASE}/api/quotations/${quotation.id}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
  });
  const sendData = await sendRes.json();
  console.log(`HTTP Status: ${sendRes.status}`);
  console.log(`emailSent: ${sendData.emailSent}, emailedTo: ${sendData.emailedTo}`);

  check("API returns 200", sendRes.status === 200);
  check("API returns emailSent=true", sendData.emailSent === true);

  // Wait for email to arrive
  console.log("\n=== Waiting 6s for email to arrive ===");
  await new Promise((r) => setTimeout(r, 6000));

  // Fetch email from inbox via IMAP and extract PDF attachment
  console.log("\n=== Fetching email from inbox via IMAP ===");
  const imapClient = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASS! },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  await imapClient.connect();
  const lock = await imapClient.getMailboxLock("INBOX");
  try {
    const uids = await imapClient.search({ subject: qCode });
    console.log(`Found ${uids.length} email(s) with subject containing ${qCode}`);

    if (uids.length === 0) {
      check("Email with quotation subject found in inbox", false);
    } else {
      check("Email with quotation subject found in inbox", true);

      const msg = await imapClient.fetchOne(uids[uids.length - 1], { envelope: true, bodyStructure: true, source: true });
      const rawEmail = msg.source;
      const rawStr = rawEmail.toString("utf8");

      const pdfBase64Match = rawStr.match(/Content-Type:\s*application\/pdf[\s\S]*?Content-Transfer-Encoding:\s*base64[\s\S]*?\r\n\r\n([\s\S]*?)--/i);

      if (pdfBase64Match) {
        check("PDF attachment found in email", true);

        const base64Data = pdfBase64Match[1].replace(/\r\n/g, "").replace(/\n/g, "").trim();
        const pdfBuffer = Buffer.from(base64Data, "base64");
        writeFileSync(`C:\\Users\\ajithkumar\\Downloads\\${qCode}-EMAIL-ATTACHMENT.pdf`, pdfBuffer);
        console.log(`PDF attachment saved: ${pdfBuffer.length} bytes`);

        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse(new Uint8Array(pdfBuffer));
        const result = await parser.getText();
        const pdfText = (result as any).text || "";

        console.log("\n--- Extracted text from EMAIL ATTACHMENT PDF (inter-state) ---\n");
        console.log(pdfText.substring(0, 1200));

        // Verify it shows IGST (inter-state) and NOT CGST+SGST
        check("Email attachment (inter-state): 'IGST Val' column present", pdfText.includes("IGST Val"));
        check("Email attachment (inter-state): NO 'CGST Val' column", !pdfText.includes("CGST Val"));
        check("Email attachment (inter-state): NO 'SGST Val' column", !pdfText.includes("SGST Val"));
        check("Email attachment (inter-state): IGST value = ₹18,000.00 (full tax)", pdfText.includes("₹18,000.00"));
        check("Email attachment (inter-state): 'IGST' label in summary", pdfText.includes("IGST"));
        check("Email attachment (inter-state): NO 'Tax Charges' label in summary", !pdfText.includes("Tax Charges"));
        check("Email attachment (inter-state): NO tax warning", !pdfText.includes("TAX WARNING"));
        check("Email attachment (inter-state): Grand Total = ₹1,18,650.00", pdfText.includes("₹1,18,650.00"));
      } else {
        check("PDF attachment found in email", false, "No base64 PDF found in raw email");
      }
    }
  } finally {
    lock.release();
  }
  await imapClient.logout();

  // Cleanup
  console.log("\n=== Cleanup ===");
  await prisma.quotationItem.deleteMany({ where: { quotationId: quotation.id } });
  await prisma.quotationStatusHistory.deleteMany({ where: { quotationId: quotation.id } });
  await prisma.followUp.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
  await prisma.communicationLog.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
  await prisma.quotation.delete({ where: { id: quotation.id } });
  if (customer.customerCode.startsWith("TEST-IGST-")) {
    await prisma.customer.delete({ where: { id: customer.id } });
  }
  console.log("Cleaned up test data");

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
