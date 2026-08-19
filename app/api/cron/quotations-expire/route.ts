import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/notifications";

// GET /api/cron/quotations-expire
// 1. Mark Sent/UnderReview quotations past validity as Expired + notify
// 2. Notify for quotations expiring within 7 days
export async function GET() {
  try {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // 1. Mark expired quotations
    const expired = await prisma.quotation.updateMany({
      where: {
        validUntil: { lt: now },
        status: { in: ["Quotation Sent", "UnderReview"] },
        deletedAt: null,
      },
      data: { status: "Expired" },
    });

    // Notify creators of expired quotations
    const expiredQuotations = await prisma.quotation.findMany({
      where: {
        validUntil: { lt: now },
        status: "Expired",
        deletedAt: null,
      },
      select: { id: true, quotationCode: true, createdById: true },
    });

    for (const q of expiredQuotations) {
      if (q.createdById) {
        await dispatchNotification({
          userId: q.createdById,
          title: "Quotation Expired",
          message: `Quotation ${q.quotationCode} has expired (past validity date).`,
          type: "quotation",
          link: `/quotations/${q.id}`,
        }).catch(() => {});
      }
    }

    // 2. Notify for quotations expiring within 7 days
    const expiringQuotations = await prisma.quotation.findMany({
      where: {
        validUntil: { gte: now, lte: sevenDaysLater },
        status: { in: ["Quotation Sent", "UnderReview"] },
        deletedAt: null,
      },
      select: { id: true, quotationCode: true, createdById: true, validUntil: true },
    });

    for (const q of expiringQuotations) {
      if (q.createdById) {
        const existing = await prisma.notification.findFirst({
          where: {
            userId: q.createdById,
            title: "Quotation Expiring Soon",
            link: `/quotations/${q.id}`,
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        });
        if (!existing) {
          await dispatchNotification({
            userId: q.createdById,
            title: "Quotation Expiring Soon",
            message: `Quotation ${q.quotationCode} expires on ${new Date(q.validUntil).toLocaleDateString()}. Follow up with customer.`,
            type: "quotation",
            link: `/quotations/${q.id}`,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      success: true,
      expired: expired.count,
      expiringSoon: expiringQuotations.length,
    });
  } catch (error: any) {
    console.error("GET /api/cron/quotations-expire error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
