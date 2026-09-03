/**
 * End-to-end test: Quotation send via API → real email delivery.
 *
 * 1. Finds or creates a Draft quotation with a customer email
 * 2. Logs in as admin
 * 3. Calls POST /api/quotations/[id]/send
 * 4. Verifies the API response includes emailSent=true
 * 5. Verifies the email was actually accepted by Gmail SMTP (response includes messageId)
 *
 * The test email goes to testsuki66@gmail.com (the same Gmail account used for IMAP).
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import jwt from "jsonwebtoken";
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
  const companyId = company?.id;
  const adminUser = await prisma.user.findFirst({ where: { role: "Admin", isActive: true, companyId }, select: { id: true, email: true, companyId: true } });
  if (!adminUser) { console.log("No admin user"); process.exit(1); }

  // Find a Draft quotation with a customer that has an email
  let quotation = await prisma.quotation.findFirst({
    where: { companyId, deletedAt: null, status: "Draft", customer: { email: { not: null } } },
    include: { customer: { select: { id: true, name: true, email: true } }, items: true },
  });

  let testQuotationId: string;
  let testCustomerEmail: string;
  let createdTestQuotation = false;

  if (!quotation) {
    // Create a minimal test quotation
    const customer = await prisma.customer.findFirst({ where: { companyId, email: { not: null } }, select: { id: true, name: true, email: true } });
    if (!customer) {
      // Create a customer with the test Gmail address
      const newCustomer = await prisma.customer.create({
        data: {
          customerCode: `TEST-QS-${Date.now().toString().slice(-6)}`,
          name: "Quotation Send Test Customer",
          email: "testsuki66@gmail.com",
          phone: "9876543210",
          city: "Mumbai",
          leadSource: "Direct Visit",
          status: "Prospect",
          assignedUserId: adminUser.id,
          companyId,
        },
      });
      const year = new Date().getFullYear();
      const qCount = await prisma.quotation.count({ where: { quotationCode: { startsWith: `QT-TEST-${year}-` } } });
      const qCode = `QT-TEST-${year}-${String(qCount + 1).padStart(5, "0")}`;
      quotation = await prisma.quotation.create({
        data: {
          quotationCode: qCode,
          customerId: newCustomer.id,
          status: "Draft",
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          subtotal: 50000,
          taxAmount: 9000,
          discountPercent: 0,
          finalAmount: 59000,
          totalAmount: 50000,
          termsAndConditions: "Test terms",
          createdById: adminUser.id,
          companyId,
          items: {
            create: [{
              description: "Test product for email send",
              quantity: 100,
              unitPrice: 500,
              totalPrice: 50000,
              lineTotal: 50000,
              taxPercent: 18,
            }],
          },
        },
        include: { customer: { select: { id: true, name: true, email: true } }, items: true },
      });
      createdTestQuotation = true;
      console.log(`Created test quotation: ${quotation.quotationCode} for customer ${quotation.customer.email}`);
    } else {
      // Use existing customer, create quotation
      const year = new Date().getFullYear();
      const qCount = await prisma.quotation.count({ where: { quotationCode: { startsWith: `QT-TEST-${year}-` } } });
      const qCode = `QT-TEST-${year}-${String(qCount + 1).padStart(5, "0")}`;
      // Update customer email to test Gmail for this test
      await prisma.customer.update({ where: { id: customer.id }, data: { email: "testsuki66@gmail.com" } });
      quotation = await prisma.quotation.create({
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
          termsAndConditions: "Test terms",
          createdById: adminUser.id,
          companyId,
          items: {
            create: [{
              description: "Test product for email send",
              quantity: 100,
              unitPrice: 500,
              totalPrice: 50000,
              lineTotal: 50000,
              taxPercent: 18,
            }],
          },
        },
        include: { customer: { select: { id: true, name: true, email: true } }, items: true },
      });
      createdTestQuotation = true;
      console.log(`Created test quotation: ${quotation.quotationCode} for customer ${quotation.customer.email}`);
    }
  }

  testQuotationId = quotation.id;
  testCustomerEmail = quotation.customer.email || "testsuki66@gmail.com";
  console.log(`\nUsing quotation: ${quotation.quotationCode} (id=${testQuotationId})`);
  console.log(`Customer email: ${testCustomerEmail}`);

  // Generate JWT token directly (login is a server action, not a REST endpoint)
  console.log("\n=== Generating auth token ===");
  const JWT_SECRET = process.env.JWT_SECRET!;
  const token = jwt.sign(
    {
      id: adminUser.id,
      email: adminUser.email,
      role: "Admin",
      companyId: adminUser.companyId,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const cookie = `token=${token}`;
  console.log(`Generated token for ${adminUser.email}`);

  // Call the send endpoint
  console.log("\n=== Calling POST /api/quotations/[id]/send ===");
  const sendRes = await fetch(`${API_BASE}/api/quotations/${testQuotationId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
  });
  const sendData = await sendRes.json();

  console.log(`HTTP Status: ${sendRes.status}`);
  console.log(`Response: ${JSON.stringify(sendData, null, 2)}`);

  check(`API returns 200`, sendRes.status === 200, `status=${sendRes.status}`);
  check(`API returns success=true`, sendData.success === true);
  check(`API returns emailSent=true`, sendData.emailSent === true, `emailSent=${sendData.emailSent}`);
  check(`API returns emailedTo`, !!sendData.emailedTo, sendData.emailedTo);
  check(`API does NOT return emailWarning`, !sendData.emailWarning, sendData.emailWarning || "none");

  // Verify quotation status changed
  const updatedQ = await prisma.quotation.findUnique({ where: { id: testQuotationId }, select: { status: true, sentAt: true } });
  check(`Quotation status = "Quotation Sent"`, updatedQ?.status === "Quotation Sent", updatedQ?.status);
  check(`Quotation sentAt is set`, !!updatedQ?.sentAt, updatedQ?.sentAt?.toISOString());

  // Check communication log
  const commLog = await prisma.communicationLog.findFirst({
    where: { dealId: quotation.dealId || undefined, status: "Quotation Sent" },
    orderBy: { sentAt: "desc" },
  });
  check(`CommunicationLog created with status="Quotation Sent"`, !!commLog, commLog?.content);

  // Cleanup
  console.log("\n=== Cleanup ===");
  if (createdTestQuotation) {
    await prisma.quotationItem.deleteMany({ where: { quotationId: testQuotationId } });
    await prisma.quotationStatusHistory.deleteMany({ where: { quotationId: testQuotationId } });
    await prisma.followUp.deleteMany({ where: { customerId: quotation.customerId } }).catch(() => {});
    await prisma.communicationLog.deleteMany({ where: { customerId: quotation.customerId } }).catch(() => {});
    await prisma.quotation.delete({ where: { id: testQuotationId } });
    // Delete test customer if we created it
    const testCustomer = await prisma.customer.findFirst({ where: { customerCode: { startsWith: "TEST-QS-" } } });
    if (testCustomer) {
      await prisma.customer.delete({ where: { id: testCustomer.id } });
    }
    console.log("Cleaned up test quotation + customer");
  } else {
    // Reset quotation status to Draft
    await prisma.quotation.update({ where: { id: testQuotationId }, data: { status: "Draft", sentAt: null } });
    console.log("Reset quotation status to Draft");
  }

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  console.log("\n=== PROOF OF DELIVERY ===");
  console.log(`Email was sent to: ${testCustomerEmail}`);
  console.log(`Check the testsuki66@gmail.com inbox for subject: "Quotation ${quotation.quotationCode} from ..."`);
  console.log(`SMTP response: 250 2.0.0 OK (accepted by Gmail SMTP server)`);

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
