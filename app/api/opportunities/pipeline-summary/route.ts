import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { buildScope } from "@/lib/scopes";

// GET /api/opportunities/pipeline-summary
// Returns weighted pipeline grouped by stage for funnel/bar chart
export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const scope = buildScope(user, "Deal");

  // Fetch all active (non-closed) deals
  const deals = await prisma.deal.findMany({
    where: {
      ...scope,
      status: { notIn: ["Won", "Lost"] },
    },
    select: {
      status: true,
      dealValue: true,
      probabilityPercent: true,
    },
  });

  // Get stage master for ordering
  const stageMasters = await prisma.pipelineStageMaster.findMany({
    where: { isActive: true, isClosedStage: false },
    orderBy: { displayOrder: "asc" },
  });

  // Group by stage
  const stageMap = new Map<string, { count: number; totalValue: number; weightedValue: number }>();

  for (const deal of deals) {
    const existing = stageMap.get(deal.status) || { count: 0, totalValue: 0, weightedValue: 0 };
    existing.count += 1;
    existing.totalValue += deal.dealValue;
    existing.weightedValue += (deal.dealValue * deal.probabilityPercent) / 100;
    stageMap.set(deal.status, existing);
  }

  // Build result ordered by display_order
  const summary = stageMasters
    .filter((sm) => stageMap.has(sm.stageName))
    .map((sm) => {
      const data = stageMap.get(sm.stageName)!;
      return {
        stage: sm.stageName,
        displayName: sm.displayName,
        displayOrder: sm.displayOrder,
        count: data.count,
        totalValue: data.totalValue,
        weightedValue: data.weightedValue,
        probabilityPercent: sm.probabilityPercent,
      };
    });

  // Add any stages not in stage master (fallback)
  for (const [stageName, data] of stageMap.entries()) {
    if (!stageMasters.find((sm) => sm.stageName === stageName)) {
      summary.push({
        stage: stageName,
        displayName: stageName,
        displayOrder: 99,
        count: data.count,
        totalValue: data.totalValue,
        weightedValue: data.weightedValue,
        probabilityPercent: 0,
      });
    }
  }

  const grandTotal = summary.reduce((sum, s) => sum + s.totalValue, 0);
  const weightedTotal = summary.reduce((sum, s) => sum + s.weightedValue, 0);
  const totalCount = summary.reduce((sum, s) => sum + s.count, 0);

  return NextResponse.json({
    success: true,
    data: summary,
    totals: {
      count: totalCount,
      totalValue: grandTotal,
      weightedValue: weightedTotal,
    },
  });
}
