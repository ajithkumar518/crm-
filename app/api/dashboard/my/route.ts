import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/dashboard/my — Sales Executive own-data KPIs
export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const companyId = user.companyId;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekEnd = new Date(now);

  // For Sales Executive: filter by assignedUserId; for Manager/Admin: no filter
  const isExecutive = user.role === "SalesExecutive";
  const assignedFilter = isExecutive ? { assignedUserId: user.id } : {};

  const [
    // Leads
    newLeadsToday,
    totalOpenLeads,
    overdueLeads,
    sqlLeads,
    // Follow-ups
    followupsDueToday,
    followupsOverdue,
    followupsPending,
    // Tasks
    tasksPending,
    tasksOverdue,
    tasksDueToday,
    // Pipeline (deals)
    activeDeals,
    // Quotations
    quotationsSentMonth,
    quotationsAcceptedMonth,
    quotationsExpiring7,
    quotationsSentValue,
    quotationsAcceptedValue,
    // RFQs
    rfqsPendingCosting,
    rfqsOverdue,
    // Visits
    visitsPlannedToday,
    visitsCompletedWeek,
    visitsMissedMonth,
    // Target
    salesTarget,
    wonDealsValue,
  ] = await Promise.all([
    // Leads
    prisma.lead.count({
      where: { ...assignedFilter, companyId, deletedAt: null, createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.lead.count({
      where: { ...assignedFilter, companyId, deletedAt: null, status: { notIn: ["Converted", "Lost", "Disqualified"] } },
    }),
    prisma.lead.count({
      where: { ...assignedFilter, companyId, deletedAt: null, slaStatus: "Overdue" },
    }),
    prisma.lead.count({
      where: { ...assignedFilter, companyId, deletedAt: null, status: { in: ["Qualified", "SQL"] } },
    }),
    // Follow-ups
    prisma.followUp.count({
      where: { ...assignedFilter, companyId, deletedAt: null, status: "Pending", nextMeetingDate: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.followUp.count({
      where: { ...assignedFilter, companyId, deletedAt: null, status: { in: ["Pending", "Overdue"] }, nextMeetingDate: { lt: now } },
    }),
    prisma.followUp.count({
      where: { ...assignedFilter, companyId, deletedAt: null, status: "Pending" },
    }),
    // Tasks
    prisma.task.count({
      where: { assignedTo: user.id, companyId, deletedAt: null, status: "Open" },
    }),
    prisma.task.count({
      where: { assignedTo: user.id, companyId, deletedAt: null, status: "Open", dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: { assignedTo: user.id, companyId, deletedAt: null, status: "Open", dueDate: { gte: todayStart, lte: todayEnd } },
    }),
    // Pipeline
    prisma.deal.findMany({
      where: { ...assignedFilter, companyId, deletedAt: null, status: { notIn: ["Won", "Lost"] } },
      select: { dealValue: true, probabilityPercent: true, status: true },
    }),
    // Quotations
    prisma.quotation.count({
      where: { createdById: user.id, companyId, deletedAt: null, sentAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.quotation.count({
      where: { createdById: user.id, companyId, deletedAt: null, acceptedAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.quotation.count({
      where: {
        createdById: user.id, companyId, deletedAt: null,
        status: "Quotation Sent", validUntil: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.quotation.aggregate({
      where: { createdById: user.id, companyId, deletedAt: null, sentAt: { gte: monthStart, lte: monthEnd } },
      _sum: { finalAmount: true },
    }),
    prisma.quotation.aggregate({
      where: { createdById: user.id, companyId, deletedAt: null, acceptedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { finalAmount: true },
    }),
    // RFQs
    prisma.rFQ.count({
      where: { ...assignedFilter, companyId, deletedAt: null, status: "CostingPending" },
    }),
    prisma.rFQ.count({
      where: { ...assignedFilter, companyId, deletedAt: null, customerDueDate: { lt: now }, status: { notIn: ["Closed", "Quoted", "Cancelled"] } },
    }),
    // Visits
    prisma.customerVisit.count({
      where: { hostedBy: user.id, companyId, deletedAt: null, status: "PLANNED", plannedDate: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.customerVisit.count({
      where: { hostedBy: user.id, companyId, deletedAt: null, status: "COMPLETED", checkOutTime: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.customerVisit.count({
      where: { hostedBy: user.id, companyId, deletedAt: null, status: "MISSED", updatedAt: { gte: monthStart, lte: monthEnd } },
    }),
    // Target
    prisma.salesTarget.findFirst({
      where: { assignedUserId: user.id, companyId, targetType: "Monthly", period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` },
      select: { targetAmount: true, achievedAmount: true },
    }),
    prisma.deal.aggregate({
      where: { ...assignedFilter, companyId, deletedAt: null, status: "Won", updatedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { dealValue: true },
    }),
  ]);

  // Pipeline by stage
  const pipelineStages = await prisma.pipelineStage.findMany({
    where: { companyId, isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true, order: true },
  });

  const byStage = pipelineStages.map((stage) => {
    const stageDeals = activeDeals.filter((d) => d.status === stage.name);
    return {
      stage: stage.name,
      color: stage.color,
      count: stageDeals.length,
      total_value: stageDeals.reduce((sum, d) => sum + d.dealValue, 0),
      weighted_value: stageDeals.reduce((sum, d) => sum + d.dealValue * (d.probabilityPercent || 0) / 100, 0),
    };
  });

  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + d.dealValue, 0);
  const weightedPipelineValue = activeDeals.reduce((sum, d) => sum + d.dealValue * (d.probabilityPercent || 0) / 100, 0);

  // Target
  const monthlyTarget = salesTarget?.targetAmount || 0;
  const achieved = wonDealsValue._sum.dealValue || 0;
  const achievementPct = monthlyTarget > 0 ? Math.round((achieved / monthlyTarget) * 1000) / 10 : 0;
  const daysRemainingInMonth = Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());

  // Trend: last week leads count for comparison
  const lastWeekLeads = await prisma.lead.count({
    where: { ...assignedFilter, companyId, deletedAt: null, createdAt: { gte: weekStart, lte: weekEnd } },
  });

  const data = {
    leads: {
      new_today: newLeadsToday,
      total_open: totalOpenLeads,
      overdue: overdueLeads,
      sql: sqlLeads,
      trend_last_week: lastWeekLeads,
    },
    followups: {
      due_today: followupsDueToday,
      overdue: followupsOverdue,
      pending: followupsPending,
    },
    tasks: {
      pending: tasksPending,
      overdue: tasksOverdue,
      due_today: tasksDueToday,
    },
    pipeline: {
      total_value: totalPipelineValue,
      weighted_value: weightedPipelineValue,
      by_stage: byStage,
    },
    quotations: {
      sent_this_month: quotationsSentMonth,
      accepted_this_month: quotationsAcceptedMonth,
      expiring_7_days: quotationsExpiring7,
      total_value_sent: quotationsSentValue._sum.finalAmount || 0,
      total_value_accepted: quotationsAcceptedValue._sum.finalAmount || 0,
    },
    rfqs: {
      pending_costing: rfqsPendingCosting,
      overdue_due_date: rfqsOverdue,
    },
    visits: {
      planned_today: visitsPlannedToday,
      completed_this_week: visitsCompletedWeek,
      missed_this_month: visitsMissedMonth,
    },
    target: {
      monthly_target: monthlyTarget,
      achieved,
      achievement_pct: achievementPct,
      days_remaining_in_month: daysRemainingInMonth,
    },
  };

  return NextResponse.json({ success: true, data });
}
