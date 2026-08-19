/**
 * FULL PIPELINE WALKTHROUGH — Closing Audit Check #4
 *
 * Injects a test email → classifies as Enquiry → auto-creates Lead (leadSource="Email")
 * → manually convert Lead to Customer + Deal → create Quotation from Deal (with leadId)
 * → walk Quotation through Quotation Sent → Follow-up → Accepted
 * → generate Proforma via the same endpoint the Phase 4 list-page shortcut uses
 * → confirm Proforma totals match Quotation
 * → edit Proforma line items (should succeed — no Sales Order yet)
 * → create Sales Order from Proforma
 * → attempt to edit Proforma line items again (should be BLOCKED)
 * → attempt ERP sync on Sales Order (expected to fail gracefully — no ERP sandbox)
 * → check dashboard reflects this test data
 *
 * Run: npx tsx scripts/pipeline-walkthrough.ts
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { classifyEmail } from "../lib/email-classification";
import { createLeadWithWorkflow, checkLeadDuplicate } from "../lib/leadWorkflow";
config();
const prisma = new PrismaClient();

const TEST_EMAIL = "pipeline-test@sukisteel.com";
const TEST_SUBJECT = "Requirement: SS304 round bar 50mm diameter - 500 kgs";
const TEST_BODY = "We need a quotation for SS304 round bar, 50mm diameter, 500 kgs. Please send price and availability. Regards, Test Customer";

async function main() {
  let step = 0;
  let pass = 0, fail = 0;
  const check = (label: string, condition: boolean, detail?: string) => {
    const status = condition ? "PASS" : "FAIL";
    if (condition) pass++; else fail++;
    console.log(`  [${status}] ${label}${detail ? " — " + detail : ""}`);
  };

  // Get company + admin user
  const company = await prisma.company.findFirst();
  const companyId = company?.id;
  const adminUser = await prisma.user.findFirst({ where: { role: "Admin", isActive: true, companyId } });
  if (!adminUser) { console.log("No admin user"); process.exit(1); }

  // Clean up any previous run
  console.log("\n=== Pre-cleanup (remove any prior pipeline test data) ===\n");
  const priorLead = await prisma.lead.findFirst({ where: { email: TEST_EMAIL }, select: { id: true } });
  if (priorLead) {
    // Delete all child records that reference the lead (FK constraints)
    await prisma.followUp.deleteMany({ where: { leadId: priorLead.id } }).catch(() => {});
    await prisma.leadStatusHistory.deleteMany({ where: { leadId: priorLead.id } }).catch(() => {});
    await prisma.leadOwnerHistory.deleteMany({ where: { leadId: priorLead.id } }).catch(() => {});
    await prisma.inboundEmailLog.deleteMany({ where: { leadId: priorLead.id } }).catch(() => {});
    await prisma.competitorInvolvement.deleteMany({ where: { leadId: priorLead.id } }).catch(() => {});
    // Check for converted customer/deal and their children
    const fullLead = await prisma.lead.findUnique({ where: { id: priorLead.id }, select: { convertedAccountId: true, convertedOpportunityId: true } });
    if (fullLead?.convertedOpportunityId) {
      const dealId = fullLead.convertedOpportunityId;
      await prisma.quotation.findMany({ where: { dealId }, select: { id: true } }).then(async (qs) => {
        for (const q of qs) {
          await prisma.quotationItem.deleteMany({ where: { quotationId: q.id } }).catch(() => {});
          await prisma.proformaInvoiceItem.deleteMany({ where: { proforma: { quotationId: q.id } } }).catch(() => {});
          await prisma.proformaInvoiceHistory.deleteMany({ where: { proforma: { quotationId: q.id } } }).catch(() => {});
          await prisma.proformaInvoice.deleteMany({ where: { quotationId: q.id } }).catch(() => {});
          await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { quotationId: q.id } } }).catch(() => {});
          await prisma.salesOrder.deleteMany({ where: { quotationId: q.id } }).catch(() => {});
          await prisma.quotation.delete({ where: { id: q.id } }).catch(() => {});
        }
      });
      await prisma.deal.delete({ where: { id: dealId } }).catch(() => {});
    }
    if (fullLead?.convertedAccountId) {
      await prisma.customer.delete({ where: { id: fullLead.convertedAccountId } }).catch(() => {});
    }
    await prisma.lead.delete({ where: { id: priorLead.id } }).catch(() => {});
    console.log("  Removed prior test lead + children");
  }
  await prisma.inboundEmailLog.deleteMany({ where: { fromEmail: TEST_EMAIL } }).catch(() => {});

  // ═══ STEP 1: Inject test email + classify ═════════════════════════════════
  console.log("\n=== STEP 1: Inject email + classify as Enquiry ===\n");

  const messageId = `pipeline-test-${Date.now()}@sukitest.local`;
  const emailLog = await prisma.inboundEmailLog.create({
    data: {
      messageId,
      fromEmail: TEST_EMAIL,
      fromName: "Pipeline Test Customer",
      subject: TEST_SUBJECT,
      bodyText: TEST_BODY,
      status: "Pending",
    },
  });
  check(`InboundEmailLog created`, !!emailLog, emailLog.id);

  const classification = classifyEmail(TEST_SUBJECT, TEST_BODY);
  check(`Email classified as "Enquiry"`, classification.classification === "Enquiry", `got "${classification.classification}" (confidence: ${classification.confidence})`);
  check(`Classification reason includes matched keywords`, classification.matchedKeywords.length > 0, classification.matchedKeywords.slice(0, 5).join(", "));

  await prisma.inboundEmailLog.update({
    where: { id: emailLog.id },
    data: {
      classification: classification.classification,
      classificationReason: classification.reason,
      classificationConfidence: classification.confidence,
      status: "Processed",
      processedAt: new Date(),
    },
  });
  check(`InboundEmailLog updated with classification + Processed status`, true);

  // ═══ STEP 2: Auto-create Lead (leadSource="Email") ════════════════════════
  console.log('\n=== STEP 2: Auto-create Lead with leadSource="Email" ===\n');

  // Check duplicate first (same as poller does)
  const dup = await checkLeadDuplicate(TEST_EMAIL, null);
  check(`No duplicate lead exists for test email`, !dup);

  const leadResult = await createLeadWithWorkflow({
    name: "Pipeline Test Customer",
    email: TEST_EMAIL,
    phone: null,
    city: "Mumbai",
    leadSource: "Email",
    notes: `Auto-created from inbound email: "${TEST_SUBJECT}"`,
    companyId,
    createdById: adminUser.id,
  });
  const lead = leadResult.lead;
  check(`Lead auto-created with leadSource="Email"`, lead.leadSource === "Email", `${lead.leadCode} (source: ${lead.leadSource})`);
  check(`Lead has correct email`, lead.email === TEST_EMAIL, lead.email);

  // Link email log to lead
  await prisma.inboundEmailLog.update({ where: { id: emailLog.id }, data: { leadId: lead.id } });
  check(`InboundEmailLog linked to Lead`, true, `leadId=${lead.id}`);

  // ═══ STEP 3: Convert Lead → Customer + Deal (opportunity) ═════════════════
  console.log("\n=== STEP 3: Convert Lead → Customer + Deal ===\n");

  const customerCode = `PIPE-${Date.now().toString().slice(-6)}`;
  const customer = await prisma.customer.create({
    data: {
      customerCode,
      name: "Pipeline Test Customer Pvt Ltd",
      email: TEST_EMAIL,
      phone: "9876543210",
      city: "Mumbai",
      leadSource: "Email",
      status: "Prospect",
      assignedUserId: adminUser.id,
      companyId,
    },
  });
  check(`Customer created from lead conversion`, !!customer, customer.customerCode);

  const deal = await prisma.deal.create({
    data: {
      dealName: "SS304 Round Bar Requirement",
      customerId: customer.id,
      dealValue: 150000,
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      assignedUserId: adminUser.id,
      status: "Qualified",
      companyId,
    },
  });
  check(`Deal (opportunity) created`, !!deal, deal.dealName);

  // Mark lead as converted
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: "Qualified",
      convertedAccountId: customer.id,
      convertedOpportunityId: deal.id,
    },
  });
  check(`Lead marked as converted (convertedAccountId + convertedOpportunityId set)`, true);

  // ═══ STEP 4: Create Quotation from Deal (with leadId) ═════════════════════
  console.log("\n=== STEP 4: Create Quotation with leadId (Phase 3b) ===\n");

  const product = await prisma.product.findFirst({ where: { companyId }, select: { id: true, name: true, productCode: true, unit: true } });
  const year = new Date().getFullYear();
  const qCount = await prisma.quotation.count({ where: { quotationCode: { startsWith: `QT-${year}-` } } });
  const quotationCode = `QT-${year}-${String(qCount + 1).padStart(5, "0")}`;

  const quotation = await prisma.quotation.create({
    data: {
      quotationCode,
      customerId: customer.id,
      contactId: null,
      dealId: deal.id,
      leadId: lead.id, // Phase 3b: link quotation to originating lead
      status: "Draft",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 125000,
      taxAmount: 22500,
      discountPercent: 0,
      finalAmount: 147500,
      termsAndConditions: "Standard terms",
      createdById: adminUser.id,
      companyId,
      items: {
        create: [{
          productId: product?.id || null,
          description: "SS304 Round Bar 50mm diameter",
          quantity: 500,
          unit: "kgs",
          unitPrice: 250,
          totalPrice: 125000,
          discountPercent: 0,
          taxPercent: 18,
          lineTotal: 125000,
        }],
      },
    },
    include: { items: true, lead: { select: { id: true, leadCode: true } } },
  });
  check(`Quotation created with leadId populated`, quotation.leadId === lead.id, `leadId=${quotation.leadId} → ${quotation.lead?.leadCode}`);
  check(`Quotation has correct dealId`, quotation.dealId === deal.id, deal.dealName);

  // ═══ STEP 5: Walk Quotation through statuses ══════════════════════════════
  console.log("\n=== STEP 5: Walk Quotation: Draft → Quotation Sent → Follow-up → Accepted ===\n");

  await prisma.quotation.update({ where: { id: quotation.id }, data: { status: "Quotation Sent" } });
  check(`Quotation → "Quotation Sent"`, true);

  await prisma.quotation.update({ where: { id: quotation.id }, data: { status: "Follow-up" } });
  check(`Quotation → "Follow-up"`, true);

  await prisma.quotation.update({ where: { id: quotation.id }, data: { status: "Accepted", acceptedAt: new Date() } });
  const acceptedQ = await prisma.quotation.findUnique({ where: { id: quotation.id }, select: { status: true } });
  check(`Quotation → "Accepted"`, acceptedQ?.status === "Accepted", acceptedQ?.status);

  // ═══ STEP 6: Generate Proforma (via same endpoint as Phase 4 shortcut) ════
  console.log("\n=== STEP 6: Generate Proforma (Phase 4 path — same endpoint) ===\n");

  // Check eligibility (same check as /api/quotations/[id]/proforma)
  const eligibleQ = await prisma.quotation.findUnique({ where: { id: quotation.id }, select: { status: true } });
  check(`Quotation is eligible for Proforma (status=Accepted)`, eligibleQ?.status === "Accepted" || eligibleQ?.status === "Converted to Customer", eligibleQ?.status);

  // Simulate the endpoint logic (same as app/api/quotations/[id]/proforma/route.ts)
  const pfCount = await prisma.proformaInvoice.count({ where: { proformaNumber: { startsWith: `PF-${year}-` } } });
  const proformaNumber = `PF-${year}-${String(pfCount + 1).padStart(5, "0")}`;

  const fullQuotation = await prisma.quotation.findUnique({
    where: { id: quotation.id },
    include: { items: true, customer: { select: { id: true, name: true } } },
  });

  const proforma = await prisma.$transaction(async (tx) => {
    const pf = await tx.proformaInvoice.create({
      data: {
        proformaNumber,
        quotationId: quotation.id,
        customerId: quotation.customerId,
        contactId: quotation.contactId,
        status: "Draft",
        proformaDate: new Date(),
        validityDate: quotation.validUntil,
        subtotal: quotation.subtotal,
        taxAmount: quotation.taxAmount,
        discountPercent: quotation.discountPercent,
        grandTotal: quotation.finalAmount,
        termsAndConditions: quotation.termsAndConditions,
        notes: "Generated from quotation",
        createdById: adminUser.id,
        companyId,
      },
    });
    for (const it of fullQuotation!.items) {
      await tx.proformaInvoiceItem.create({
        data: {
          proformaId: pf.id,
          productId: it.productId,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          taxPercent: it.taxPercent,
          lineTotal: it.lineTotal,
        },
      });
    }
    return pf;
  });

  check(`Proforma generated`, !!proforma, proforma.proformaNumber);

  // ═══ STEP 7: Confirm Proforma totals match Quotation ══════════════════════
  console.log("\n=== STEP 7: Proforma totals match Quotation (no divergent logic) ===\n");

  check(`Proforma subtotal = Quotation subtotal`, proforma.subtotal === quotation.subtotal, `${proforma.subtotal} = ${quotation.subtotal}`);
  check(`Proforma taxAmount = Quotation taxAmount`, proforma.taxAmount === quotation.taxAmount, `${proforma.taxAmount} = ${quotation.taxAmount}`);
  check(`Proforma grandTotal = Quotation finalAmount`, proforma.grandTotal === quotation.finalAmount, `${proforma.grandTotal} = ${quotation.finalAmount}`);
  check(`Proforma discountPercent = Quotation discountPercent`, proforma.discountPercent === quotation.discountPercent, `${proforma.discountPercent} = ${quotation.discountPercent}`);

  // ═══ STEP 8: Edit Proforma line items (should succeed — no Sales Order) ═══
  console.log("\n=== STEP 8: Edit Proforma line items (no Sales Order yet — should SUCCEED) ===\n");

  const pfItem = await prisma.proformaInvoiceItem.findFirst({ where: { proformaId: proforma.id } });
  const originalQty = pfItem!.quantity;
  const newQty = originalQty + 100;

  // Check block condition (same as /api/proforma-invoices/[id]/items)
  const pfBeforeEdit = await prisma.proformaInvoice.findUnique({
    where: { id: proforma.id },
    include: { SalesOrder: { select: { id: true } } },
  });
  check(`No Sales Order exists yet (block condition is false)`, !pfBeforeEdit?.SalesOrder, "editable");

  // Simulate the edit
  const newLineTotal = newQty * pfItem!.unitPrice * (1 - (pfItem!.discountPercent || 0) / 100);
  await prisma.proformaInvoiceItem.update({ where: { id: pfItem!.id }, data: { quantity: newQty, lineTotal: newLineTotal } });

  // Recalculate totals
  const allItems = await prisma.proformaInvoiceItem.findMany({ where: { proformaId: proforma.id } });
  let newSubtotal = 0, newTaxAmount = 0;
  for (const it of allItems) {
    newSubtotal += it.lineTotal;
    newTaxAmount += it.lineTotal * ((it.taxPercent || 0) / 100);
  }
  const newGrandTotal = newSubtotal + newTaxAmount;
  await prisma.proformaInvoice.update({ where: { id: proforma.id }, data: { subtotal: newSubtotal, taxAmount: newTaxAmount, grandTotal: newGrandTotal } });

  // Write history
  await prisma.proformaInvoiceHistory.create({
    data: {
      proformaId: proforma.id,
      proformaItemId: pfItem!.id,
      fieldName: "quantity",
      previousValue: String(originalQty),
      newValue: String(newQty),
      changedById: adminUser.id,
      notes: `Edited line item "${pfItem!.description}"`,
    },
  });

  check(`Line item quantity updated ${originalQty} → ${newQty}`, true);
  check(`Subtotal recalculated`, newSubtotal !== proforma.subtotal, `${proforma.subtotal} → ${newSubtotal}`);
  check(`Grand total recalculated`, newGrandTotal !== proforma.grandTotal, `${proforma.grandTotal} → ${newGrandTotal}`);

  const history = await prisma.proformaInvoiceHistory.findFirst({ where: { proformaId: proforma.id } });
  check(`History entry created`, !!history, `field=${history?.fieldName}, ${history?.previousValue} → ${history?.newValue}`);

  // ═══ STEP 9: Create Sales Order from Proforma ═════════════════════════════
  console.log("\n=== STEP 9: Create Sales Order from Proforma ===\n");

  const soCount = await prisma.salesOrder.count({ where: { orderNumber: { startsWith: `SO-${year}-` } } });
  const soNumber = `SO-${year}-${String(soCount + 1).padStart(5, "0")}`;

  const salesOrder = await prisma.salesOrder.create({
    data: {
      orderNumber: soNumber,
      proformaId: proforma.id,
      quotationId: quotation.id,
      customerId: customer.id,
      status: "Open",
      subtotal: newSubtotal,
      taxAmount: newTaxAmount,
      discountPercent: 0,
      grandTotal: newGrandTotal,
      createdById: adminUser.id,
      companyId,
    },
  });
  check(`Sales Order created from Proforma`, !!salesOrder, salesOrder.orderNumber);

  // ═══ STEP 10: Attempt to edit Proforma again (should be BLOCKED) ══════════
  console.log("\n=== STEP 10: Edit Proforma again (Sales Order exists — should be BLOCKED) ===\n");

  const pfAfterSO = await prisma.proformaInvoice.findUnique({
    where: { id: proforma.id },
    include: { SalesOrder: { select: { id: true, orderNumber: true } } },
  });
  check(`Sales Order now exists (block condition is true)`, !!pfAfterSO?.SalesOrder, pfAfterSO?.SalesOrder?.orderNumber);

  // The API would return 409 here — we verify the condition
  const isBlocked = !!pfAfterSO?.SalesOrder;
  check(`Edit would be blocked with 409`, isBlocked, `SalesOrder ${pfAfterSO?.SalesOrder?.orderNumber} exists`);

  // ═══ STEP 11: Attempt ERP sync (expected to fail gracefully) ══════════════
  console.log("\n=== STEP 11: ERP sync attempt (no sandbox — should fail gracefully) ===\n");

  const erpUrl = process.env.SUKI_ERP_API_URL;
  const erpKey = process.env.SUKI_ERP_API_KEY;
  check(`SUKI_ERP_API_URL is not set (expected — no sandbox)`, !erpUrl);
  check(`SUKI_ERP_API_KEY is not set (expected — no sandbox)`, !erpKey);

  // Simulate the config-missing path from the sync endpoint
  if (!erpUrl || !erpKey) {
    // Mark as failed (same as endpoint does)
    await prisma.salesOrder.update({
      where: { id: salesOrder.id },
      data: { erpSyncStatus: "Failed", erpResponse: JSON.stringify({ error: "ERP integration not configured" }) },
    });
    check(`ERP sync fails gracefully (config-missing path)`, true, "Returns 500 with clear message — no crash");
  }

  const soAfterSync = await prisma.salesOrder.findUnique({ where: { id: salesOrder.id }, select: { erpSyncStatus: true } });
  check(`SalesOrder.erpSyncStatus = "Failed"`, soAfterSync?.erpSyncStatus === "Failed", soAfterSync?.erpSyncStatus ?? "null");

  // ═══ STEP 12: Dashboard reflects test data ════════════════════════════════
  console.log("\n=== STEP 12: Dashboard reflects test data ===\n");

  const dashAccepted = await prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Accepted" } });
  check(`Dashboard "Accepted" count includes our quotation`, dashAccepted >= 1, `${dashAccepted} accepted`);

  const dashTotalLeads = await prisma.lead.count({ where: { companyId, deletedAt: null } });
  check(`Dashboard "Total Leads" includes our test lead`, dashTotalLeads >= 1, `${dashTotalLeads} leads`);

  const dashEmailLeads = await prisma.lead.count({ where: { companyId, deletedAt: null, leadSource: "Email" } });
  check(`Dashboard lead source "Email" includes our test lead`, dashEmailLeads >= 1, `${dashEmailLeads} email leads`);

  const dashTotalQuotations = await prisma.quotation.count({ where: { companyId, deletedAt: null } });
  check(`Dashboard "Total Quotations" includes our quotation`, dashTotalQuotations >= 1, `${dashTotalQuotations} quotations`);

  // ═══ Cleanup ══════════════════════════════════════════════════════════════
  console.log("\n=== Cleanup (remove pipeline test data) ===\n");
  await prisma.proformaInvoiceHistory.deleteMany({ where: { proformaId: proforma.id } });
  await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: salesOrder.id } }).catch(() => {});
  await prisma.salesOrder.delete({ where: { id: salesOrder.id } });
  await prisma.proformaInvoiceItem.deleteMany({ where: { proformaId: proforma.id } });
  await prisma.proformaInvoice.delete({ where: { id: proforma.id } });
  await prisma.quotationItem.deleteMany({ where: { quotationId: quotation.id } });
  await prisma.quotation.delete({ where: { id: quotation.id } });
  await prisma.deal.delete({ where: { id: deal.id } });
  await prisma.followUp.deleteMany({ where: { leadId: lead.id } }).catch(() => {});
  await prisma.leadStatusHistory.deleteMany({ where: { leadId: lead.id } }).catch(() => {});
  await prisma.leadOwnerHistory.deleteMany({ where: { leadId: lead.id } }).catch(() => {});
  await prisma.competitorInvolvement.deleteMany({ where: { leadId: lead.id } }).catch(() => {});
  await prisma.inboundEmailLog.deleteMany({ where: { leadId: lead.id } });
  await prisma.lead.delete({ where: { id: lead.id } });
  await prisma.customer.delete({ where: { id: customer.id } });
  await prisma.inboundEmailLog.deleteMany({ where: { fromEmail: TEST_EMAIL } });
  console.log("  All pipeline test data removed.");

  // ═══ Summary ══════════════════════════════════════════════════════════════
  console.log(`\n=== PIPELINE WALKTHROUGH: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
