import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const statuses = searchParams.get("status")?.split(",").filter(Boolean) || [];
    const customerId = searchParams.get("customerId") || "";
    const assignedUserId = searchParams.get("assignedUserId") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { companyId: user.companyId, deletedAt: null, status: { not: "Draft" } };
    if (statuses.length > 0) where.status = { in: statuses };
    if (customerId) where.customerId = customerId;
    if (assignedUserId) where.createdById = assignedUserId;
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt.gte = new Date(startDate);
      if (endDate) where.sentAt.lte = new Date(endDate + "T23:59:59");
    }
    if (user.role === "SalesExecutive") where.createdById = user.id;

    const quotations = await prisma.quotation.findMany({
      where,
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { sentAt: "desc" },
    });

    const totalSent = quotations.length;
    const accepted = quotations.filter((q) => q.status === "Accepted").length;
    const totalSentValue = quotations.reduce((s, q) => s + (q.finalAmount || 0), 0);
    const totalAcceptedValue = quotations.filter((q) => q.status === "Accepted").reduce((s, q) => s + (q.finalAmount || 0), 0);
    const conversionRate = totalSent > 0 ? Math.round((accepted / totalSent) * 1000) / 10 : 0;
    const avgDiscountPercent = totalSent > 0 ? Math.round(quotations.reduce((s, q) => s + (q.discountPercent || 0), 0) / totalSent * 10) / 10 : 0;

    const formattedQuotations = quotations.map((q) => {
      const daysToRespond = q.sentAt && q.acceptedAt
        ? Math.floor((new Date(q.acceptedAt).getTime() - new Date(q.sentAt).getTime()) / (1000 * 60 * 60 * 24))
        : q.sentAt && q.rejectedAt
          ? Math.floor((new Date(q.rejectedAt).getTime() - new Date(q.sentAt).getTime()) / (1000 * 60 * 60 * 24))
          : null;
      return {
        id: q.id,
        quotationCode: q.quotationCode,
        customerName: q.customer?.name || "—",
        status: q.status,
        totalAmount: q.totalAmount || 0,
        discountPercent: q.discountPercent || 0,
        finalAmount: q.finalAmount || 0,
        validUntil: new Date(q.validUntil).toISOString(),
        sentAt: q.sentAt ? new Date(q.sentAt).toISOString() : null,
        respondedAt: q.acceptedAt ? new Date(q.acceptedAt).toISOString() : q.rejectedAt ? new Date(q.rejectedAt).toISOString() : null,
        daysToRespond,
      };
    });

    return NextResponse.json({
      success: true,
      summary: { totalSent, accepted, totalSentValue, totalAcceptedValue, conversionRate, avgDiscountPercent },
      quotations: formattedQuotations,
    });
  } catch (error: any) {
    console.error("Error in GET /api/reports/quotations:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred while fetching quotations." },
      { status: 500 }
    );
  }
}
