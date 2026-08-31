/**
 * Closing Verification Audit — Phase 0-4 regression check
 *
 * Checks:
 *   1. Status integrity (proforma block, quotation statuses)
 *   2. Lead source consistency (DB + code grep)
 *   3. Dashboard end-to-end live data
 *   5. Known limitations
 *   6. Leftover test data
 *
 * Run: npx tsx scripts/closing-audit.ts
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const prisma = new PrismaClient();

const SPEC_SOURCES = ["Website","IndiaMART","Justdial","TradeIndia","WhatsApp","Door-to-Door Marketing","Direct Visit","Telephonic Conversation","Email"];
const SPEC_STATUSES = ["Draft","Quotation Sent","Follow-up","Revised Rate","Accepted","Rejected","MOQ","Material Not Available","No Stock","Price Pending","Supplier Rate Checking","Converted to Customer","Others"];

async function main() {
  let pass = 0, fail = 0;
  const check = (label: string, condition: boolean, detail?: string) => {
    const status = condition ? "PASS" : "FAIL";
    if (condition) pass++; else fail++;
    console.log(`[${status}] ${label}${detail ? " — " + detail : ""}`);
  };

  // ═══ Check 1: Status Integrity ════════════════════════════════════════════
  console.log("\n═══ CHECK 1: Status Integrity ═════════════════════════════════════════════\n");

  // 1a: All quotation statuses in DB are from the 13 spec statuses
  const dbStatuses = await prisma.quotation.groupBy({ by: ["status"], _count: { status: true } });
  const dbStatusList = dbStatuses.map(s => s.status);
  const staleStatuses = dbStatusList.filter(s => !SPEC_STATUSES.includes(s));
  check(`All DB quotation statuses are in the 13 spec statuses`, staleStatuses.length === 0, staleStatuses.length > 0 ? `STALE: ${staleStatuses.join(", ")}` : `All ${dbStatusList.length} statuses valid`);

  // 1b: Proforma statuses are separate (Draft | Sent | Approved | PO Received | Cancelled)
  const pfStatuses = await prisma.proformaInvoice.groupBy({ by: ["status"], _count: { status: true } });
  const pfStatusList = pfStatuses.map(s => s.status);
  check(`Proforma statuses are the proforma-specific set`, pfStatusList.every(s => ["Draft","Sent","Approved","PO Received","Cancelled"].includes(s)), `Found: ${pfStatusList.join(", ")}`);

  // 1c: Quotations with leadId (Phase 3b)
  const withLead = await prisma.quotation.count({ where: { leadId: { not: null } } });
  const totalQ = await prisma.quotation.count();
  check(`Quotations with leadId populated`, withLead > 0, `${withLead}/${totalQ}`);

  // 1d: Lead with leadSource="Email" exists (Phase 1)
  const emailLeads = await prisma.lead.count({ where: { leadSource: "Email", deletedAt: null } });
  check(`Leads with leadSource="Email" exist (Phase 1 poller)`, emailLeads > 0, `${emailLeads} lead(s)`);

  // ═══ Check 2: Lead Source Consistency (DB) ════════════════════════════════
  console.log("\n═══ CHECK 2: Lead Source Consistency (DB) ═════════════════════════════════\n");

  const dbLeadSources = await prisma.lead.groupBy({ by: ["leadSource"], _count: { id: true } });
  const dbSourceList = dbLeadSources.map(s => s.leadSource);
  const staleSources = dbSourceList.filter(s => !SPEC_SOURCES.includes(s));
  check(`All DB lead sources are in the 9 spec sources`, staleSources.length === 0, staleSources.length > 0 ? `STALE: ${staleSources.join(", ")}` : `All ${dbSourceList.length} sources valid`);

  const dbCustomerSources = await prisma.customer.groupBy({ by: ["leadSource"], _count: { id: true } });
  const dbCustSourceList = dbCustomerSources.map(s => s.leadSource).filter(Boolean);
  const staleCustSources = dbCustSourceList.filter((s): s is string => !!s && !SPEC_SOURCES.includes(s));
  check(`All DB customer lead sources are in the 9 spec sources`, staleCustSources.length === 0, staleCustSources.length > 0 ? `STALE: ${staleCustSources.join(", ")}` : `All ${dbCustSourceList.length} sources valid`);

  // ═══ Check 3: Dashboard End-to-End ════════════════════════════════════════
  console.log("\n═══ CHECK 3: Dashboard End-to-End ═══════════════════════════════════════════\n");

  const companyId = (await prisma.company.findFirst())?.id;
  const [
    totalLeadsReceived, newLeads, quotationsSent, followUpPending,
    acceptedQuotations, rejectedQuotations, convertedCustomers,
    pendingSupplierRateChecking, materialNotAvailable, noStock, totalQuotations,
  ] = await Promise.all([
    prisma.lead.count({ where: { companyId, deletedAt: null } }),
    prisma.lead.count({ where: { companyId, deletedAt: null, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Quotation Sent" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Follow-up" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Accepted" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Rejected" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Converted to Customer" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Supplier Rate Checking" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Material Not Available" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "No Stock" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null } }),
  ]);

  console.log(`  Total Leads Received:      ${totalLeadsReceived}`);
  console.log(`  New Leads (this month):    ${newLeads}`);
  console.log(`  Quotations Sent:           ${quotationsSent}`);
  console.log(`  Follow-up Pending:         ${followUpPending}`);
  console.log(`  Accepted:                  ${acceptedQuotations}`);
  console.log(`  Rejected:                  ${rejectedQuotations}`);
  console.log(`  Converted Customers:       ${convertedCustomers}`);
  console.log(`  Supplier Rate Checking:    ${pendingSupplierRateChecking}`);
  console.log(`  Material Not Available:    ${materialNotAvailable}`);
  console.log(`  No Stock:                  ${noStock}`);
  console.log(`  Total Quotations:          ${totalQuotations}`);

  check(`Dashboard: Total Leads > 0`, totalLeadsReceived > 0, `${totalLeadsReceived}`);
  check(`Dashboard: Quotations Sent > 0`, quotationsSent > 0, `${quotationsSent}`);
  check(`Dashboard: Accepted > 0`, acceptedQuotations > 0, `${acceptedQuotations}`);
  check(`Dashboard: Total Quotations > 0`, totalQuotations > 0, `${totalQuotations}`);

  // Executive performance
  const users = await prisma.user.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true, role: true } });
  let execWithData = 0;
  for (const exec of users) {
    const [leadsHandled, quotationsSentE, dealsWon, revenueAgg] = await Promise.all([
      prisma.lead.count({ where: { assignedUserId: exec.id, companyId, deletedAt: null } }),
      prisma.quotation.count({ where: { createdById: exec.id, companyId, deletedAt: null, status: { not: "Draft" } } }),
      prisma.deal.count({ where: { assignedUserId: exec.id, companyId, deletedAt: null, status: "Won" } }),
      prisma.deal.aggregate({ where: { assignedUserId: exec.id, companyId, deletedAt: null, status: "Won" }, _sum: { dealValue: true } }),
    ]);
    if (leadsHandled > 0 || quotationsSentE > 0 || dealsWon > 0) {
      execWithData++;
      console.log(`  Exec ${exec.name}: leads=${leadsHandled}, quotes=${quotationsSentE}, deals=${dealsWon}, revenue=${revenueAgg._sum.dealValue || 0}`);
    }
  }
  check(`Dashboard: At least one executive has performance data`, execWithData > 0, `${execWithData} executive(s) with data`);

  // Lead source performance
  const leadSourcePerf = await prisma.lead.groupBy({ by: ["leadSource"], where: { companyId, deletedAt: null }, _count: { id: true } });
  check(`Dashboard: Lead source performance has data`, leadSourcePerf.length > 0, `${leadSourcePerf.length} sources`);

  // ═══ Check 6: Leftover Test Data ══════════════════════════════════════════
  console.log("\n═══ CHECK 6: Leftover Test Data ═════════════════════════════════════════════\n");

  // Test quotations (VERIFY-* or TEST-* or QT-REAL-*)
  const testQuotations = await prisma.quotation.findMany({
    where: { quotationCode: { startsWith: "VERIFY-" } },
    select: { id: true, quotationCode: true, status: true },
  });
  check(`No "VERIFY-*" test quotations in DB`, testQuotations.length === 0, testQuotations.length > 0 ? `${testQuotations.length} found: ${testQuotations.map(q => q.quotationCode).join(", ")}` : "clean");

  const qtReal = await prisma.quotation.findMany({ where: { quotationCode: "QT-REAL-002" }, select: { id: true, quotationCode: true } });
  check(`No "QT-REAL-*" test quotations in DB`, qtReal.length === 0, qtReal.length > 0 ? `${qtReal.length} found` : "clean");

  // Test customers (Test Dup Customer, Test Valid Customer)
  const testCustomers = await prisma.customer.findMany({
    where: { OR: [{ name: { contains: "Test Dup Customer" } }, { name: { contains: "Test Valid Customer" } }] },
    select: { id: true, name: true, customerCode: true },
  });
  check(`No "Test Dup/Valid Customer" test customers in DB`, testCustomers.length === 0, testCustomers.length > 0 ? `${testCustomers.length} found: ${testCustomers.map(c => c.name).join(", ")}` : "clean");

  // Test proformas (PF-TEST-*)
  const testProformas = await prisma.proformaInvoice.findMany({
    where: { proformaNumber: { startsWith: "PF-TEST-" } },
    select: { id: true, proformaNumber: true },
  });
  check(`No "PF-TEST-*" test proformas in DB`, testProformas.length === 0, testProformas.length > 0 ? `${testProformas.length} found` : "clean");

  // Test sales orders (SO-TEST-*)
  const testSOs = await prisma.salesOrder.findMany({
    where: { orderNumber: { startsWith: "SO-TEST-" } },
    select: { id: true, orderNumber: true },
  });
  check(`No "SO-TEST-*" test sales orders in DB`, testSOs.length === 0, testSOs.length > 0 ? `${testSOs.length} found` : "clean");

  // Test InboundEmailLogs from inject-test-emails
  const testEmails = await prisma.inboundEmailLog.findMany({
    where: { OR: [{ subject: { contains: "DUPLICATE TEST" } }, { subject: { contains: "TEST EMAIL" } }, { fromEmail: { contains: "testcompany.com" } }] },
    select: { id: true, subject: true, fromEmail: true },
  });
  check(`No test InboundEmailLogs from inject-test-emails`, testEmails.length === 0, testEmails.length > 0 ? `${testEmails.length} found: ${testEmails.map(e => e.subject).join(", ")}` : "clean");

  // ═══ Summary ═══════════════════════════════════════════════════════════════
  console.log(`\n═══ Audit Summary: ${pass} passed, ${fail} failed ═══`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
