// @ts-nocheck
/**
 * AUDIT: Find all quotations and proformas that were generated or emailed
 * while the fabricated company_gstin (32AAAAA0000A1Z5) was live in SystemConfig.
 *
 * The fake GSTIN was set during the previous task session and removed now.
 * We need to find:
 *   1. All quotations with status "Quotation Sent" (emailed) — check recipient
 *   2. All proforma invoices that were emailed — check recipient
 *   3. All CRMDocuments of type QuotationRevision (PDF generation events)
 *   4. All audit logs related to quotation/proforma PDF generation or sending
 *
 * For each, determine if the recipient was the internal test inbox
 * (testsuki66@gmail.com) or a real customer email.
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

async function main() {
  console.log("=== AUDIT: Quotations and Proformas affected by fabricated GSTIN ===\n");
  console.log("Fabricated value: 32AAAAA0000A1Z5 (was set in SystemConfig.company_gstin)\n");

  // The fake GSTIN was set during the previous session. We need to find all
  // quotation/proforma activity since then. Since we don't have an exact timestamp,
  // we'll list ALL sent quotations and proformas, and ALL PDF generation events.

  // ── 1. All quotations with status "Quotation Sent" ──
  console.log("=== 1. Quotations with status 'Quotation Sent' (emailed) ===\n");
  const sentQuotations = await prisma.quotation.findMany({
    where: { status: "Quotation Sent", deletedAt: null },
    include: {
      customer: { select: { name: true, email: true, state: true, gstNumber: true } },
      contact: { select: { name: true, email: true } },
      company: { select: { name: true } },
    },
    orderBy: { sentAt: "desc" },
  });

  console.log(`Found ${sentQuotations.length} quotation(s) with status "Quotation Sent":\n`);
  for (const q of sentQuotations) {
    const recipientEmail = q.customer?.email || q.contact?.email || "(no email)";
    const isTestInbox = recipientEmail === "testsuki66@gmail.com";
    const flag = isTestInbox ? "[TEST INBOX]" : "[!!! REAL CUSTOMER !!!]";
    console.log(`  ${flag} ${q.quotationCode}`);
    console.log(`    Sent at: ${q.sentAt?.toISOString() || "unknown"}`);
    console.log(`    Customer: ${q.customer?.name || "n/a"}`);
    console.log(`    Customer state: ${q.customer?.state || "n/a"}`);
    console.log(`    Customer GSTIN: ${q.customer?.gstNumber || "n/a"}`);
    console.log(`    Recipient email: ${recipientEmail}`);
    console.log(`    Final amount: ₹${q.finalAmount}`);
    console.log();
  }

  // ── 2. All proforma invoices that were emailed ──
  console.log("\n=== 2. Proforma Invoices (emailed) ===\n");
  // Check if ProformaInvoice has a sentAt or status field
  const proformaColumns = await prisma.$queryRaw`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ProformaInvoice'
    AND (COLUMN_NAME LIKE '%sent%' OR COLUMN_NAME LIKE '%email%' OR COLUMN_NAME LIKE '%status%')
  ` as any;
  console.log("ProformaInvoice relevant columns:", proformaColumns.map((c: any) => c.COLUMN_NAME));

  const proformas = await prisma.proformaInvoice.findMany({
    include: {
      customer: { select: { name: true, email: true, state: true, gstNumber: true } },
      contact: { select: { name: true, email: true } },
      quotation: { select: { quotationCode: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\nFound ${proformas.length} proforma invoice(s) total:\n`);
  for (const pi of proformas) {
    const recipientEmail = pi.customer?.email || pi.contact?.email || "(no email)";
    const isTestInbox = recipientEmail === "testsuki66@gmail.com";
    const flag = isTestInbox ? "[TEST INBOX]" : "[!!! REAL CUSTOMER !!!]";
    console.log(`  ${flag} ${pi.proformaCode || pi.id}`);
    console.log(`    Created at: ${pi.createdAt?.toISOString() || "unknown"}`);
    console.log(`    Status: ${(pi as any).status || "n/a"}`);
    console.log(`    Customer: ${pi.customer?.name || "n/a"}`);
    console.log(`    Customer state: ${pi.customer?.state || "n/a"}`);
    console.log(`    Customer GSTIN: ${pi.customer?.gstNumber || "n/a"}`);
    console.log(`    Recipient email: ${recipientEmail}`);
    console.log();
  }

  // ── 3. CRMDocuments of type QuotationRevision (PDF generation events) ──
  console.log("\n=== 3. CRMDocuments — Quotation PDF generation events ===\n");
  const pdfDocs = await prisma.cRMDocument.findMany({
    where: { documentType: "QuotationRevision" },
    include: { uploadedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${pdfDocs.length} quotation PDF document(s):\n`);
  for (const d of pdfDocs) {
    console.log(`  ${d.documentCode} — ${d.name}`);
    console.log(`    Created at: ${d.createdAt?.toISOString() || "unknown"}`);
    console.log(`    File URL: ${d.fileUrl}`);
    console.log(`    Uploaded by: ${d.uploadedBy?.name || d.uploadedBy?.email || "n/a"}`);
    console.log();
  }

  // ── 4. Audit logs for quotation/proforma send or PDF generation ──
  console.log("\n=== 4. Audit logs — Quotation/Proforma send & PDF generation ===\n");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { contains: "Send" } },
        { action: { contains: "GeneratePDF" } },
        { action: { contains: "Email" } },
        { entityType: { in: ["Quotation", "ProformaInvoice"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  console.log(`Found ${auditLogs.length} recent audit log(s):\n`);
  for (const a of auditLogs) {
    console.log(`  ${a.createdAt?.toISOString()} | ${a.entityType} | ${a.action} | ${a.description}`);
    console.log();
  }

  // ── 5. EmailLog records (if any) ──
  console.log("\n=== 5. Email logs ===\n");
  try {
    const emailLogs = await prisma.$queryRaw`
      SELECT TOP 50 * FROM EmailLog ORDER BY createdAt DESC
    ` as any;
    console.log(`Found ${emailLogs.length} email log(s):\n`);
    for (const e of emailLogs) {
      const isTestInbox = e.recipient === "testsuki66@gmail.com" || e.to === "testsuki66@gmail.com";
      const flag = isTestInbox ? "[TEST INBOX]" : "[!!! REAL CUSTOMER !!!]";
      console.log(`  ${flag} ${e.createdAt?.toISOString?.() || e.createdAt} | to=${e.recipient || e.to || "n/a"} | subject=${e.subject || "n/a"} | status=${e.status || "n/a"}`);
    }
  } catch (err: any) {
    console.log(`EmailLog table not accessible: ${err.message}`);
    // Try CommunicationLog instead
    try {
      const commLogs = await prisma.communicationLog.findMany({
        where: { channel: "Email" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { customer: { select: { name: true, email: true } } },
      });
      console.log(`\nFound ${commLogs.length} email communication log(s):\n`);
      for (const c of commLogs) {
        const recipientEmail = c.customer?.email || (c as any).recipientEmail || "(unknown)";
        const isTestInbox = recipientEmail === "testsuki66@gmail.com";
        const flag = isTestInbox ? "[TEST INBOX]" : "[!!! REAL CUSTOMER !!!]";
        console.log(`  ${flag} ${c.createdAt?.toISOString()} | customer=${c.customer?.name || "n/a"} | email=${recipientEmail} | subject=${(c as any).subject || "n/a"}`);
      }
    } catch (err2: any) {
      console.log(`CommunicationLog also not accessible: ${err2.message}`);
    }
  }

  // ── Summary ──
  console.log("\n=== AUDIT SUMMARY ===\n");
  const realCustomerQuotations = sentQuotations.filter(q => {
    const email = q.customer?.email || q.contact?.email;
    return email && email !== "testsuki66@gmail.com";
  });
  const testInboxQuotations = sentQuotations.filter(q => {
    const email = q.customer?.email || q.contact?.email;
    return email === "testsuki66@gmail.com";
  });

  console.log(`Quotations sent to REAL customers: ${realCustomerQuotations.length}`);
  if (realCustomerQuotations.length > 0) {
    console.log("  !!! ATTENTION: Real customers received quotations with fabricated GSTIN !!!");
    for (const q of realCustomerQuotations) {
      console.log(`    - ${q.quotationCode} → ${q.customer?.email}`);
    }
  }
  console.log(`\nQuotations sent to TEST inbox only: ${testInboxQuotations.length}`);
  for (const q of testInboxQuotations) {
    console.log(`  - ${q.quotationCode}`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
