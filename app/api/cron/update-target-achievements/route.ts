import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getPeriodDateRange(targetType: string, period: string): { start: Date; end: Date } {
  if (targetType === "Monthly") {
    const [year, month] = period.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  } else if (targetType === "Quarterly") {
    const [yearStr, qStr] = period.split("-Q");
    const year = parseInt(yearStr);
    const q = parseInt(qStr);
    const startMonth = (q - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
  } else {
    const year = parseInt(period);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
}

export async function POST() {
  try {
    const targets = await prisma.salesTarget.findMany();

    let updated = 0;
    for (const t of targets) {
      const { start, end } = getPeriodDateRange(t.targetType, t.period);

      const poWhere: any = {
        status: "Approved",
        approvedAt: { gte: start, lte: end },
      };
      if (t.companyId) poWhere.companyId = t.companyId;
      if (t.assignedUserId) poWhere.assignedUserId = t.assignedUserId;

      const approvedPOs = await prisma.purchaseOrder.findMany({
        where: poWhere,
        select: { finalAmount: true, totalAmount: true },
      });

      const achieved = approvedPOs.reduce((sum, po) => sum + (po.finalAmount || po.totalAmount || 0), 0);

      if (t.achievedAmount !== achieved) {
        await prisma.salesTarget.update({
          where: { id: t.id },
          data: { achievedAmount: achieved },
        });
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} of ${targets.length} targets`,
      updated,
      total: targets.length,
    });
  } catch (error) {
    console.error("Update target achievements error:", error);
    return NextResponse.json({ success: false, message: "Failed to update achievements" }, { status: 500 });
  }
}
