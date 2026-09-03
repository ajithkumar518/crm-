// @ts-nocheck
/**
 * End-to-end test: Trigger quotation send → fetch email from inbox →
 * extract PDF attachment → verify it's the CORRECTED format (not the old one).
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

  // Create a test quotation with customer email = testsuki66@gmail.com
  const year = new Date().getFullYear();
  const qCount = await prisma.quotation.count({ where: { quotationCode: { startsWith: `QT-EMAIL-${year}-` } } });
  const qCode = `QT-EMAIL-${year}-${String(qCount + 1).padStart(5, "0")}`;

  // Find or create a customer with the test Gmail address
  let customer = await prisma.customer.findFirst({ where: { email: "testsuki66@gmail.com", companyId: adminUser.companyId } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        customerCode: `TEST-EMAIL-${Date.now().toString().slice(-6)}`,
        name: "Email Attachment Test Customer",
        email: "testsuki66@gmail.com",
        phone: "9876543210",
        city: "Mumbai",
        state: "Maharashtra",
        billingAddress: "2/470 Test Address",
        shippingAddress: "2/470 Test Address",
        leadSource: "Direct Visit",
        status: "Prospect",
        assignedUserId: adminUser.id,
        companyId: adminUser.companyId,
      },
    });
  }

  const quotation = await prisma.quotation.create({
    data: {
      quotationCode: qCode,
      customerId: customer.id,
      status: "Draft",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 50000,
      taxAmount: 9000,
      discountPercent: 0,
      finalAmount: 59000,
      totalAmount: 50000,
      transportCharge: 22,
      otherCharges: 123,
      weighingLoadingCharge: 123,
      deliveryCharge: 123,
      testingCharge: 22.94,
      termsAndConditions: "Cutting Charges – Extra\nWeighing/Loading Charges – Rs. 350/- per Ton\nDelivery Charges – Extra\nTesting Charges – Extra",
      createdById: adminUser.id,
      companyId: adminUser.companyId,
      items: {
        create: [{
          description: "SS304 Round Bar",
          productType: "Bright Bar",
          rmMake: "SAIL",
          numberOfPieces: 23,
          quantity: 100,
          unitPrice: 500,
          totalPrice: 50000,
          lineTotal: 50000,
          taxPercent: 18,
          cuttingCharge: 23,
          remarks: "Test remarks",
          unit: "kgs",
        }],
      },
    },
    include: { items: true, customer: { select: { email: true } } },
  });

  console.log(`Created test quotation: ${qCode} (id=${quotation.id})`);
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
  check("API returns emailedTo", !!sendData.emailedTo);

  // Wait for email to arrive
  console.log("\n=== Waiting 5s for email to arrive ===");
  await new Promise((r) => setTimeout(r, 5000));

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

      // Fetch the email with attachments
      const msg = await imapClient.fetchOne(uids[uids.length - 1], { envelope: true, bodyStructure: true, source: true });

      // Parse the raw email source to find PDF attachment
      const rawEmail = msg.source;
      const rawStr = rawEmail.toString("utf8");

      // Find PDF attachment (base64 encoded)
      const pdfBase64Match = rawStr.match(/Content-Type:\s*application\/pdf[\s\S]*?Content-Transfer-Encoding:\s*base64[\s\S]*?\r\n\r\n([\s\S]*?)--/i);

      if (pdfBase64Match) {
        check("PDF attachment found in email", true);

        // Decode base64 PDF
        const base64Data = pdfBase64Match[1].replace(/\r\n/g, "").replace(/\n/g, "").trim();
        const pdfBuffer = Buffer.from(base64Data, "base64");
        writeFileSync(`C:\\Users\\ajithkumar\\Downloads\\${qCode}-EMAIL-ATTACHMENT.pdf`, pdfBuffer);
        console.log(`PDF attachment saved: ${pdfBuffer.length} bytes`);

        // Extract text from the PDF attachment
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse(new Uint8Array(pdfBuffer));
        const result = await parser.getText();
        const pdfText = (result as any).text || "";

        console.log("\n--- Extracted text from EMAIL ATTACHMENT PDF ---\n");
        console.log(pdfText.substring(0, 500));

        // Verify it's the CORRECTED format (not the old one)
        check("Email attachment: 'SBS' header (correct format)", pdfText.includes("SBS"));
        check("Email attachment: 'BILL TO' + 'SHIP TO' (correct format)", pdfText.includes("BILL TO") && pdfText.includes("SHIP TO"));
        check("Email attachment: 'CGST Val' column (correct format)", pdfText.includes("CGST Val"));
        check("Email attachment: 'SGST Val' column (correct format)", pdfText.includes("SGST Val"));
        check("Email attachment: 'Amount In Words' (correct format)", pdfText.includes("Amount In Words"));
        check("Email attachment: 'Taxable Val' (correct format)", pdfText.includes("Taxable Val"));
        check("Email attachment: NO 'QUOTATION' header (old format absent)", !pdfText.startsWith("QUOTATION"));
        check("Email attachment: NO 'Gross Total' (old format absent)", !pdfText.includes("Gross Total"));
        check("Email attachment: NO 'Net Subtotal' (old format absent)", !pdfText.includes("Net Subtotal"));
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
  // Delete test customer if we created it
  if (customer.customerCode.startsWith("TEST-EMAIL-")) {
    await prisma.customer.delete({ where: { id: customer.id } });
  }
  console.log("Cleaned up test data");

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
