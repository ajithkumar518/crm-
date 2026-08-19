import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

// GET /api/dashboard/manager — Sales Manager / Admin dashboard with team performance
export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "SalesExecutive" || user.role === "Customer") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const guard = enforceModuleGuard(user, MODULE_KEYS.MANAGER_DASHBOARD, "GET /api/dashboard/manager");
  if (guard) return guard;

  // SuperAdmin must use support mode to access client dashboard data
  if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
    return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
  }

  const companyId = user.companyId;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekEnd = new Date(now);

  const baseFilter = { companyId, deletedAt: null };

  const [
    newLeadsToday, totalOpenLeads, overdueLeads, sqlLeads,
    followupsDueToday, followupsOverdue, followupsPending,
    tasksPending, tasksOverdue, tasksDueToday,
    activeDeals,
    quotationsSentMonth, quotationsAcceptedMonth, quotationsExpiring7,
    quotationsSentValue, quotationsAcceptedValue,
    rfqsPendingCosting, rfqsOverdue,
    visitsPlannedToday, visitsCompletedWeek, visitsMissedMonth,
    salesTarget, wonDealsValue,
    wonDealsThisMonth, lostDeals,
    wonDealsWithDates,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...baseFilter, createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.lead.count({ where: { ...baseFilter, status: { notIn: ["Converted", "Lost", "Disqualified"] } } }),
    prisma.lead.count({ where: { ...baseFilter, slaStatus: "Overdue" } }),
    prisma.lead.count({ where: { ...baseFilter, status: { in: ["Qualified", "SQL"] } } }),
    prisma.followUp.count({ where: { ...baseFilter, status: "Pending", nextMeetingDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.followUp.count({ where: { ...baseFilter, status: { in: ["Pending", "Overdue"] }, nextMeetingDate: { lt: now } } }),
    prisma.followUp.count({ where: { ...baseFilter, status: "Pending" } }),
    prisma.task.count({ where: { companyId, deletedAt: null, status: "Open" } }),
    prisma.task.count({ where: { companyId, deletedAt: null, status: "Open", dueDate: { lt: now } } }),
    prisma.task.count({ where: { companyId, deletedAt: null, status: "Open", dueDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.deal.findMany({ where: { ...baseFilter, status: { notIn: ["Won", "Lost"] } }, select: { dealValue: true, probabilityPercent: true, status: true } }),
    prisma.quotation.count({ where: { ...baseFilter, sentAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.quotation.count({ where: { ...baseFilter, acceptedAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.quotation.count({ where: { ...baseFilter, status: "Quotation Sent", validUntil: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.quotation.aggregate({ where: { ...baseFilter, sentAt: { gte: monthStart, lte: monthEnd } }, _sum: { finalAmount: true } }),
    prisma.quotation.aggregate({ where: { ...baseFilter, acceptedAt: { gte: monthStart, lte: monthEnd } }, _sum: { finalAmount: true } }),
    prisma.rFQ.count({ where: { ...baseFilter, status: "CostingPending" } }),
    prisma.rFQ.count({ where: { ...baseFilter, customerDueDate: { lt: now }, status: { notIn: ["Closed", "Quoted", "Cancelled"] } } }),
    prisma.customerVisit.count({ where: { ...baseFilter, status: "PLANNED", plannedDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.customerVisit.count({ where: { ...baseFilter, status: "COMPLETED", checkOutTime: { gte: weekStart, lte: weekEnd } } }),
    prisma.customerVisit.count({ where: { ...baseFilter, status: "MISSED", updatedAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.salesTarget.findFirst({ where: { companyId, targetType: "Monthly", period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` }, select: { targetAmount: true, achievedAmount: true } }),
    prisma.deal.aggregate({ where: { ...baseFilter, status: "Won", updatedAt: { gte: monthStart, lte: monthEnd } }, _sum: { dealValue: true } }),
    prisma.deal.count({ where: { ...baseFilter, status: "Won", updatedAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.deal.count({ where: { ...baseFilter, status: "Lost", updatedAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.deal.findMany({ where: { ...baseFilter, status: "Won", updatedAt: { gte: monthStart, lte: monthEnd } }, select: { createdAt: true, updatedAt: true } }),
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

  // Win rate
  const totalClosed = wonDealsThisMonth + lostDeals;
  const winRate = totalClosed > 0 ? Math.round((wonDealsThisMonth / totalClosed) * 1000) / 10 : 0;

  // Avg sales cycle
  const avgSalesCycleDays = wonDealsWithDates.length > 0
    ? Math.round(wonDealsWithDates.reduce((sum, d) => {
        const days = Math.floor((new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / wonDealsWithDates.length)
    : 0;

  // Team performance
  const executives = await prisma.user.findMany({
    where: { companyId, role: "SalesExecutive", isActive: true },
    select: { id: true, name: true },
  });

  const teamPerformance = await Promise.all(
    executives.map(async (exec) => {
      const [leadsCount, pipelineValue, quotationsSent, visitsCompleted, dealsWonValue, execTarget] = await Promise.all([
        prisma.lead.count({ where: { assignedUserId: exec.id, companyId, deletedAt: null, status: { notIn: ["Converted", "Lost", "Disqualified"] } } }),
        prisma.deal.aggregate({ where: { assignedUserId: exec.id, companyId, deletedAt: null, status: { notIn: ["Won", "Lost"] } }, _sum: { dealValue: true } }),
        prisma.quotation.count({ where: { createdById: exec.id, companyId, deletedAt: null, sentAt: { gte: monthStart, lte: monthEnd } } }),
        prisma.customerVisit.count({ where: { hostedBy: exec.id, companyId, deletedAt: null, status: "COMPLETED", checkOutTime: { gte: monthStart, lte: monthEnd } } }),
        prisma.deal.aggregate({ where: { assignedUserId: exec.id, companyId, deletedAt: null, status: "Won", updatedAt: { gte: monthStart, lte: monthEnd } }, _sum: { dealValue: true } }),
        prisma.salesTarget.findFirst({ where: { assignedUserId: exec.id, companyId, targetType: "Monthly", period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` }, select: { targetAmount: true } }),
      ]);
      const execAchieved = dealsWonValue._sum.dealValue || 0;
      const execTargetAmount = execTarget?.targetAmount || 0;
      return {
        user_id: exec.id,
        full_name: exec.name,
        leads_count: leadsCount,
        pipeline_value: pipelineValue._sum.dealValue || 0,
        quotations_sent: quotationsSent,
        visits_completed: visitsCompleted,
        achievement_pct: execTargetAmount > 0 ? Math.round((execAchieved / execTargetAmount) * 1000) / 10 : 0,
      };
    })
  );

  const lastWeekLeads = await prisma.lead.count({ where: { ...baseFilter, createdAt: { gte: weekStart, lte: weekEnd } } });

  const data = {
    leads: { new_today: newLeadsToday, total_open: totalOpenLeads, overdue: overdueLeads, sql: sqlLeads, trend_last_week: lastWeekLeads },
    followups: { due_today: followupsDueToday, overdue: followupsOverdue, pending: followupsPending },
    tasks: { pending: tasksPending, overdue: tasksOverdue, due_today: tasksDueToday },
    pipeline: { total_value: totalPipelineValue, weighted_value: weightedPipelineValue, by_stage: byStage },
    quotations: { sent_this_month: quotationsSentMonth, accepted_this_month: quotationsAcceptedMonth, expiring_7_days: quotationsExpiring7, total_value_sent: quotationsSentValue._sum.finalAmount || 0, total_value_accepted: quotationsAcceptedValue._sum.finalAmount || 0 },
    rfqs: { pending_costing: rfqsPendingCosting, overdue_due_date: rfqsOverdue },
    visits: { planned_today: visitsPlannedToday, completed_this_week: visitsCompletedWeek, missed_this_month: visitsMissedMonth },
    target: { monthly_target: monthlyTarget, achieved, achievement_pct: achievementPct, days_remaining_in_month: daysRemainingInMonth },
    team_performance: teamPerformance,
    win_rate: winRate,
    avg_sales_cycle_days: avgSalesCycleDays,
  };

  return NextResponse.json({ success: true, data });
}
