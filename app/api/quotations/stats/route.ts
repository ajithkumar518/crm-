import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const where = { deletedAt: null, companyId: user.companyId };

  const [total, draft, sent, accepted, rejected, expired] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.count({ where: { ...where, status: "Draft" } }),
    prisma.quotation.count({ where: { ...where, status: "Quotation Sent" } }),
    prisma.quotation.count({ where: { ...where, status: "Accepted" } }),
    prisma.quotation.count({ where: { ...where, status: "Rejected" } }),
    prisma.quotation.count({ where: { ...where, status: "Expired" } }),
  ]);

  // Expiring soon (within 7 days)
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const expiringSoon = await prisma.quotation.count({
    where: {
      ...where,
      status: "Quotation Sent",
      validUntil: { gte: now, lte: sevenDaysLater },
    },
  });

  // Already expired (validity passed, still Quotation Sent)
  const expiredPending = await prisma.quotation.count({
    where: {
      ...where,
      status: "Quotation Sent",
      validUntil: { lt: now },
    },
  });

  // Total value of accepted quotations
  const acceptedValue = await prisma.quotation.aggregate({
    where: { ...where, status: "Accepted" },
    _sum: { finalAmount: true },
  });

  // Total value of sent quotations
  const sentValue = await prisma.quotation.aggregate({
    where: { ...where, status: "Quotation Sent" },
    _sum: { finalAmount: true },
  });

  // Conversion rate
  const conversionRate = sent + accepted + rejected + expired > 0
    ? (accepted / (sent + accepted + rejected + expired) * 100).toFixed(1)
    : "0.0";

  return NextResponse.json({
    success: true,
    data: {
      total,
      byStatus: { Draft: draft, "Quotation Sent": sent, Accepted: accepted, Rejected: rejected, Expired: expired },
      expiringSoon,
      expiredPending,
      acceptedValue: acceptedValue._sum.finalAmount || 0,
      sentValue: sentValue._sum.finalAmount || 0,
      conversionRate: parseFloat(conversionRate),
    },
  });
}
