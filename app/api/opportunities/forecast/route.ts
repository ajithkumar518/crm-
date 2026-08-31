import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { buildScope } from "@/lib/scopes";

// GET /api/opportunities/forecast
// Returns weighted pipeline per user/territory for dashboard forecasting
export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const scope = buildScope(user, "Deal");

  // Fetch active deals with assigned user info
  const deals = await prisma.deal.findMany({
    where: {
      ...scope,
      status: { notIn: ["Won", "Lost"] },
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      customer: { select: { id: true, name: true, city: true } },
    },
    orderBy: { dealValue: "desc" },
  });

  // Group by assigned user
  const userMap = new Map<string, {
    userId: string;
    userName: string;
    count: number;
    totalValue: number;
    weightedValue: number;
    overdueCount: number;
  }>();

  for (const deal of deals) {
    const userId = deal.assignedUserId || "unassigned";
    const userName = deal.assignedUser?.name || "Unassigned";
    const existing = userMap.get(userId) || {
      userId,
      userName,
      count: 0,
      totalValue: 0,
      weightedValue: 0,
      overdueCount: 0,
    };
    existing.count += 1;
    existing.totalValue += deal.dealValue;
    existing.weightedValue += (deal.dealValue * deal.probabilityPercent) / 100;
    if (deal.isOverdue) existing.overdueCount += 1;
    userMap.set(userId, existing);
  }

  const byUser = Array.from(userMap.values()).sort((a, b) => b.weightedValue - a.weightedValue);

  // Monthly forecast based on expectedCloseDate
  const monthlyMap = new Map<string, { month: string; count: number; totalValue: number; weightedValue: number }>();
  for (const deal of deals) {
    const closeDate = new Date(deal.expectedCloseDate);
    const monthKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyMap.get(monthKey) || { month: monthKey, count: 0, totalValue: 0, weightedValue: 0 };
    existing.count += 1;
    existing.totalValue += deal.dealValue;
    existing.weightedValue += (deal.dealValue * deal.probabilityPercent) / 100;
    monthlyMap.set(monthKey, existing);
  }

  const byMonth = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  const grandTotal = deals.reduce((s, d) => s + d.dealValue, 0);
  const weightedTotal = deals.reduce((s, d) => s + (d.dealValue * d.probabilityPercent) / 100, 0);

  return NextResponse.json({
    success: true,
    data: {
      byUser,
      byMonth,
      totals: {
        count: deals.length,
        totalValue: grandTotal,
        weightedValue: weightedTotal,
      },
    },
  });
}
