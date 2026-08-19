// @ts-nocheck
/**
 * Focused audit: Determine if QT-2026-00005 (sent to asdfg@gmail.com) was sent
 * while the fabricated GSTIN was live, or before it was set.
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

async function main() {
  // ── 1. QT-2026-00005 full details ──
  console.log("=== QT-2026-00005 full details ===\n");
  const q5 = await prisma.quotation.findFirst({
    where: { quotationCode: "QT-2026-00005" },
    include: {
      customer: { select: { name: true, email: true, state: true, gstNumber: true, phone: true } },
      contact: { select: { name: true, email: true, phone: true } },
      items: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
  console.log(JSON.stringify(q5, null, 2));

  // ── 2. All quotations ordered by createdAt ──
  console.log("\n=== All quotations (ordered by createdAt desc) ===\n");
  const allQ = await prisma.quotation.findMany({
    where: { deletedAt: null },
    select: { id: true, quotationCode: true, status: true, sentAt: true, createdAt: true, updatedAt: true, customerId: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  for (const q of allQ) {
    console.log(`  ${q.quotationCode} | status=${q.status} | createdAt=${q.createdAt?.toISOString()} | sentAt=${q.sentAt?.toISOString() || "null"}`);
  }

  // ── 3. Audit logs — all, ordered by timestamp desc ──
  console.log("\n=== Recent audit logs (last 50) ===\n");
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 50,
    select: { timestamp: true, module: true, action: true, details: true, userId: true, resourceId: true },
  });
  for (const l of logs) {
    console.log(`  ${l.timestamp?.toISOString()} | ${l.module} | ${l.action} | ${(l.details || "").substring(0, 100)}`);
  }

  // ── 4. Check if there's a SystemConfig audit trail ──
  console.log("\n=== SystemConfig-related audit logs ===\n");
  const cfgLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { contains: "Config" } },
        { action: { contains: "config" } },
        { details: { contains: "gstin" } },
        { details: { contains: "GSTIN" } },
        { details: { contains: "company_gstin" } },
        { module: "SystemConfig" },
      ],
    },
    orderBy: { timestamp: "desc" },
    take: 20,
  });
  console.log(`Found ${cfgLogs.length} config-related audit logs`);
  for (const l of cfgLogs) {
    console.log(`  ${l.timestamp?.toISOString()} | ${l.module} | ${l.action} | ${l.details}`);
  }

  // ── 5. EmailLog table check ──
  console.log("\n=== EmailLog table ===\n");
  try {
    const emailLogs = await prisma.$queryRaw`SELECT TOP 50 * FROM EmailLog ORDER BY createdAt DESC` as any;
    console.log(`Found ${emailLogs.length} email logs`);
    for (const e of emailLogs) {
      const recipient = e.recipient || e.toAddress || e.to_address || "(unknown)";
      const isTest = recipient === "testsuki66@gmail.com";
      const flag = isTest ? "[TEST]" : "[REAL]";
      console.log(`  ${flag} ${e.createdAt?.toISOString?.() || e.createdAt} | to=${recipient} | subject=${e.subject || "n/a"}`);
    }
  } catch (err: any) {
    console.log(`EmailLog table not accessible: ${err.message?.substring(0, 100)}`);
  }

  // ── 6. CommunicationLog ──
  console.log("\n=== CommunicationLog (Email channel) ===\n");
  try {
    const commLogs = await prisma.communicationLog.findMany({
      where: { channel: "Email" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { customer: { select: { name: true, email: true } } },
    });
    console.log(`Found ${commLogs.length} email communication logs`);
    for (const c of commLogs) {
      const email = c.customer?.email || "(unknown)";
      const isTest = email === "testsuki66@gmail.com";
      const flag = isTest ? "[TEST]" : "[REAL]";
      console.log(`  ${flag} ${c.createdAt?.toISOString()} | customer=${c.customer?.name || "n/a"} | email=${email} | subject=${(c as any).subject || "n/a"}`);
    }
  } catch (err: any) {
    console.log(`CommunicationLog not accessible: ${err.message?.substring(0, 100)}`);
  }

  // ── 7. Proforma invoices ──
  console.log("\n=== Proforma Invoices ===\n");
  const proformas = await prisma.proformaInvoice.findMany({
    include: {
      customer: { select: { name: true, email: true, state: true, gstNumber: true } },
      contact: { select: { name: true, email: true } },
      quotation: { select: { quotationCode: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`Found ${proformas.length} proforma invoices`);
  for (const pi of proformas) {
    const email = pi.customer?.email || pi.contact?.email || "(no email)";
    const isTest = email === "testsuki66@gmail.com";
    const flag = isTest ? "[TEST]" : "[REAL]";
    console.log(`  ${flag} ${pi.proformaNumber} | createdAt=${pi.createdAt?.toISOString()} | status=${pi.status} | customer=${pi.customer?.name} | email=${email}`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
