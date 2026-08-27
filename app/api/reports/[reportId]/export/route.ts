import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { buildScope } from "@/lib/scopes";
import { createFormattedWorkbook, writeWorkbookBuffer, EXCEL_CONTENT_TYPE } from "@/lib/excel-utils";

const REPORT_CONFIG: Record<string, { sheetName: string; columns: string[]; fetch: (user: any, filters: any) => Promise<{ rows: any[]; summary: Record<string, any> }> }> = {
  leads: {
    sheetName: "Lead Report",
    columns: ["Lead Code", "Company Name", "Source", "Status", "Lead Score", "Assigned To", "Created At", "Days In Status"],
    fetch: async (user, filters) => {
      const scope = buildScope(user, "Lead");
      const where: any = { ...scope };
      if (filters.startDate) where.createdAt = { ...where.createdAt, gte: new Date(filters.startDate) };
      if (filters.endDate) where.createdAt = { ...where.createdAt, lte: new Date(filters.endDate + "T23:59:59") };
      if (filters.status && filters.status !== "All") where.status = filters.status;
      if (filters.assignedTo && filters.assignedTo !== "All") where.assignedUserId = filters.assignedTo;

      const leads = await prisma.lead.findMany({
        where,
        include: { assignedUser: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      const now = new Date();
      const rows = leads.map((l) => ({
        "Lead Code": l.leadCode || "—",
        "Company Name": l.companyName || l.name || "—",
        "Source": l.leadSource || "—",
        "Status": l.status,
        "Lead Score": l.leadScore || 0,
        "Assigned To": l.assignedUser?.name || "—",
        "Created At": new Date(l.createdAt).toLocaleDateString(),
        "Days In Status": Math.floor((now.getTime() - new Date(l.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
      }));
      return { rows, summary: { "Total Leads": leads.length } };
    },
  },
  opportunities: {
    sheetName: "Opportunity Report",
    columns: ["Opportunity Code", "Opportunity Name", "Account", "Stage", "Value", "Probability %", "Expected Close", "Assigned To", "Days Open", "Overdue"],
    fetch: async (user, filters) => {
      const where: any = { companyId: user.companyId, deletedAt: null };
      if (user.role === "SalesExecutive") where.assignedUserId = user.id;
      if (filters.status && filters.status !== "All") where.status = filters.status;
      if (filters.assignedTo && filters.assignedTo !== "All") where.assignedUserId = filters.assignedTo;
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
        if (filters.endDate) where.createdAt.lte = new Date(filters.endDate + "T23:59:59");
      }
      const deals = await prisma.deal.findMany({
        where,
        include: { customer: { select: { name: true } }, assignedUser: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      const now = new Date();
      const rows = deals.map((d) => ({
        "Opportunity Code": d.opportunityCode || "—",
        "Opportunity Name": d.dealName,
        "Account": d.customer?.name || "—",
        "Stage": d.status,
        "Value": d.dealValue,
        "Probability %": d.probabilityPercent || 0,
        "Expected Close": d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : "—",
        "Assigned To": d.assignedUser?.name || "—",
        "Days Open": Math.floor((now.getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        "Overdue": d.expectedCloseDate && new Date(d.expectedCloseDate) < now && !["Won", "Lost"].includes(d.status) ? "Yes" : "No",
      }));
      const totalPipeline = deals.filter((d) => !["Won", "Lost"].includes(d.status)).reduce((s, d) => s + d.dealValue, 0);
      return { rows, summary: { "Total Opportunities": deals.length, "Total Pipeline": totalPipeline } };
    },
  },
  quotations: {
    sheetName: "Quotation Report",
    columns: ["Quotation Code", "Account", "Status", "Grand Total", "Discount %", "Validity Date", "Sent At", "Responded At", "Days To Respond"],
    fetch: async (user, filters) => {
      const where: any = { companyId: user.companyId, deletedAt: null, status: { not: "Draft" } };
      if (user.role === "SalesExecutive") where.createdById = user.id;
      if (filters.status && filters.status !== "All") where.status = { in: filters.status.split(",") };
      if (filters.startDate || filters.endDate) {
        where.sentAt = {};
        if (filters.startDate) where.sentAt.gte = new Date(filters.startDate);
        if (filters.endDate) where.sentAt.lte = new Date(filters.endDate + "T23:59:59");
      }
      const quotations = await prisma.quotation.findMany({
        where,
        include: { customer: { select: { name: true } } },
        orderBy: { sentAt: "desc" },
      });
      const rows = quotations.map((q) => {
        const daysToRespond = q.sentAt && q.acceptedAt
          ? Math.floor((new Date(q.acceptedAt).getTime() - new Date(q.sentAt).getTime()) / (1000 * 60 * 60 * 24))
          : q.sentAt && q.rejectedAt
            ? Math.floor((new Date(q.rejectedAt).getTime() - new Date(q.sentAt).getTime()) / (1000 * 60 * 60 * 24))
            : null;
        return {
          "Quotation Code": q.quotationCode,
          "Account": q.customer?.name || "—",
          "Status": q.status,
          "Grand Total": q.finalAmount || 0,
          "Discount %": q.discountPercent || 0,
          "Validity Date": new Date(q.validUntil).toLocaleDateString(),
          "Sent At": q.sentAt ? new Date(q.sentAt).toLocaleDateString() : "—",
          "Responded At": q.acceptedAt ? new Date(q.acceptedAt).toLocaleDateString() : q.rejectedAt ? new Date(q.rejectedAt).toLocaleDateString() : "—",
          "Days To Respond": daysToRespond ?? "—",
        };
      });
      const totalValue = quotations.reduce((s, q) => s + (q.finalAmount || 0), 0);
      return { rows, summary: { "Total Quotations": quotations.length, "Total Value": totalValue } };
    },
  },
  rfqs: {
    sheetName: "RFQ Report",
    columns: ["RFQ Code", "Account", "Priority", "Status", "Received Date", "Customer Due Date", "Days To Quote", "Linked Quotation"],
    fetch: async (user, filters) => {
      const where: any = { companyId: user.companyId, deletedAt: null };
      if (user.role === "SalesExecutive") where.assignedUserId = user.id;
      if (filters.status && filters.status !== "All") where.status = { in: filters.status.split(",") };
      if (filters.startDate || filters.endDate) {
        where.receivedDate = {};
        if (filters.startDate) where.receivedDate.gte = new Date(filters.startDate);
        if (filters.endDate) where.receivedDate.lte = new Date(filters.endDate + "T23:59:59");
      }
      const rfqs = await prisma.rFQ.findMany({
        where,
        include: { customer: { select: { name: true } }, quotations: { select: { quotationCode: true }, take: 1, orderBy: { createdAt: "desc" } } },
        orderBy: { receivedDate: "desc" },
      });
      const rows = rfqs.map((r) => ({
        "RFQ Code": r.rfqCode,
        "Account": r.customer?.name || "—",
        "Priority": r.priority || "Normal",
        "Status": r.status,
        "Received Date": r.receivedDate ? new Date(r.receivedDate).toLocaleDateString() : "—",
        "Customer Due Date": r.customerDueDate ? new Date(r.customerDueDate).toLocaleDateString() : "—",
        "Days To Quote": r.quotations.length > 0 && r.receivedDate ? Math.floor((new Date(r.updatedAt).getTime() - new Date(r.receivedDate).getTime()) / (1000 * 60 * 60 * 24)) : "—",
        "Linked Quotation": r.quotations[0]?.quotationCode || "—",
      }));
      return { rows, summary: { "Total RFQs": rfqs.length } };
    },
  },
  "follow-ups": {
    sheetName: "Follow-Up Report",
    columns: ["Type", "Related To", "Scheduled Date", "Assigned To", "Status", "Days Overdue"],
    fetch: async (user, filters) => {
      const scope = buildScope(user, "FollowUp");
      const where: any = { ...scope };
      if (filters.status && filters.status !== "All") where.status = filters.status;
      if (filters.startDate || filters.endDate) {
        where.nextMeetingDate = {};
        if (filters.startDate) where.nextMeetingDate.gte = new Date(filters.startDate);
        if (filters.endDate) where.nextMeetingDate.lte = new Date(filters.endDate + "T23:59:59");
      }
      const followUps = await prisma.followUp.findMany({
        where,
        include: { customer: { select: { name: true } }, lead: { select: { name: true } }, assignedUser: { select: { name: true } } },
        orderBy: { nextMeetingDate: "asc" },
      });
      const now = new Date();
      const rows = followUps.map((f) => ({
        "Type": f.type || "—",
        "Related To": f.customer?.name || f.lead?.name || "—",
        "Scheduled Date": f.nextMeetingDate ? new Date(f.nextMeetingDate).toLocaleDateString() : "—",
        "Assigned To": f.assignedUser?.name || "—",
        "Status": f.status,
        "Days Overdue": f.nextMeetingDate && new Date(f.nextMeetingDate) < now && f.status !== "Completed" && f.status !== "Cancelled"
          ? Math.floor((now.getTime() - new Date(f.nextMeetingDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      }));
      return { rows, summary: { "Total Follow-Ups": followUps.length } };
    },
  },
  visits: {
    sheetName: "Visit Report",
    columns: ["Account", "Plant Location", "Purpose", "Planned Date", "Status", "Summary", "Assigned To"],
    fetch: async (user, filters) => {
      const where: any = { companyId: user.companyId, deletedAt: null };
      if (user.role === "SalesExecutive") where.hostedBy = user.id;
      if (filters.status && filters.status !== "All") {
        if (filters.status === "Planned") where.status = "PLANNED";
        else if (filters.status === "Completed") where.status = "COMPLETED";
        else if (filters.status === "Missed") where.status = "MISSED";
      }
      const visits = await prisma.customerVisit.findMany({
        where,
        include: { customer: { select: { name: true } }, host: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      const rows = visits.map((v) => ({
        "Account": v.customer?.name || "—",
        "Plant Location": v.plantLocationId || "—",
        "Purpose": v.purpose || "—",
        "Planned Date": v.plannedDate ? new Date(v.plannedDate).toLocaleDateString() : v.checkInTime ? new Date(v.checkInTime).toLocaleDateString() : "—",
        "Status": v.status,
        "Summary": v.meetingSummary || v.visitSummary || "",
        "Assigned To": v.host?.name || "—",
      }));
      return { rows, summary: { "Total Visits": visits.length } };
    },
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer" || user.role === "SalesExecutive") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { reportId } = await params;
  const config = REPORT_CONFIG[reportId];
  if (!config) return NextResponse.json({ success: false, message: "Invalid report ID" }, { status: 400 });

  const body = await request.json();
  const { format, filters = {} } = body;

  if (format !== "excel") {
    return NextResponse.json({ success: false, message: "Only Excel export is supported" }, { status: 400 });
  }

  const { rows, summary } = await config.fetch(user, filters);

  // Build Excel with consistent formatting
  const workbook = createFormattedWorkbook(
    config.sheetName,
    config.columns,
    rows.map((row) => config.columns.map((col) => row[col] ?? "—")),
    config.columns.map(() => 22)
  );
  const sheet = workbook.worksheets[0];

  // Summary rows
  const summaryLabels = Object.keys(summary);
  if (summaryLabels.length > 0) {
    sheet.addRow([]);
    for (const label of summaryLabels) {
      const r = sheet.addRow([label, summary[label]]);
      r.font = { bold: true };
    }
  }

  const buffer = await writeWorkbookBuffer(workbook);

  // Log export
  await prisma.reportExportLog.create({
    data: {
      reportId,
      exportedById: user.id,
      filtersJson: JSON.stringify(filters),
      format: "excel",
      companyId: user.companyId,
    },
  });

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": EXCEL_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${reportId}-report.xlsx"`,
    },
  });
}
