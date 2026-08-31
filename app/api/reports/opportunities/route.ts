import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const stages = searchParams.get("stage")?.split(",").filter(Boolean) || [];
  const assignedUserId = searchParams.get("assignedUserId") || "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: any = { companyId: user.companyId, deletedAt: null };
  if (stages.length > 0) where.status = { in: stages };
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + "T23:59:59");
  }
  if (user.role === "SalesExecutive") where.assignedUserId = user.id;

  const deals = await prisma.deal.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const total = deals.length;
  const won = deals.filter((d) => d.status === "Won").length;
  const lost = deals.filter((d) => d.status === "Lost").length;
  const active = deals.filter((d) => !["Won", "Lost"].includes(d.status));
  const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : 0;

  const totalPipeline = active.reduce((s, d) => s + d.dealValue, 0);
  const weightedPipeline = active.reduce((s, d) => s + d.dealValue * (d.probabilityPercent || 0) / 100, 0);
  const avgDealSize = total > 0 ? Math.round(deals.reduce((s, d) => s + d.dealValue, 0) / total) : 0;

  // Avg sales cycle for won deals
  const wonDeals = deals.filter((d) => d.status === "Won");
  const avgSalesCycleDays = wonDeals.length > 0
    ? Math.round(wonDeals.reduce((s, d) => {
        const days = Math.floor((new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return s + days;
      }, 0) / wonDeals.length)
    : 0;

  const formattedDeals = deals.map((d) => {
    const daysOpen = Math.floor((now.getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = d.expectedCloseDate && new Date(d.expectedCloseDate) < now && !["Won", "Lost"].includes(d.status);
    return {
      id: d.id,
      opportunityCode: d.opportunityCode || d.dealName,
      dealName: d.dealName,
      customerName: d.customer?.name || "—",
      stage: d.status,
      dealValue: d.dealValue,
      probabilityPercent: d.probabilityPercent || 0,
      expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate).toISOString() : null,
      assignedTo: d.assignedUser?.name || "—",
      createdDate: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      daysOpen,
      isOverdue: !!isOverdue,
    };
  });

  return NextResponse.json({
    success: true,
    summary: { total, won, lost, active: active.length, winRate, totalPipeline, weightedPipeline, avgDealSize, avgSalesCycleDays },
    deals: formattedDeals,
  });
}
