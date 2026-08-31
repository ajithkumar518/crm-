import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const statuses = searchParams.get("status")?.split(",").filter(Boolean) || [];
  const customerId = searchParams.get("customerId") || "";
  const assignedUserId = searchParams.get("assignedUserId") || "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: any = { companyId: user.companyId, deletedAt: null };
  if (statuses.length > 0) where.status = { in: statuses };
  if (customerId) where.customerId = customerId;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (startDate || endDate) {
    where.receivedDate = {};
    if (startDate) where.receivedDate.gte = new Date(startDate);
    if (endDate) where.receivedDate.lte = new Date(endDate + "T23:59:59");
  }
  if (user.role === "SalesExecutive") where.assignedUserId = user.id;

  const rfqs = await prisma.rFQ.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
      quotations: { select: { id: true, quotationCode: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
    orderBy: { receivedDate: "desc" },
  });

  const now = new Date();
  const total = rfqs.length;
  const converted = rfqs.filter((r) => r.status === "Quoted" || r.status === "Closed").length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;
  const overdueCount = rfqs.filter((r) => r.customerDueDate && new Date(r.customerDueDate) < now && !["Closed", "Quoted", "Cancelled"].includes(r.status)).length;

  // Avg turnaround: days from receivedDate to first quotation sentAt
  const turnarounds = rfqs.filter((r) => r.quotations.length > 0 && r.receivedDate);
  const avgTurnaroundDays = turnarounds.length > 0
    ? Math.round(turnarounds.reduce((sum, r) => {
        const q = r.quotations[0];
        // Use quotation createdAt as proxy for sentAt
        const days = Math.floor((new Date(q.id ? r.updatedAt : r.updatedAt).getTime() - new Date(r.receivedDate).getTime()) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, days);
      }, 0) / turnarounds.length)
    : 0;

  const formattedRfqs = rfqs.map((r) => {
    const daysToQuote = r.quotations.length > 0 && r.receivedDate
      ? Math.floor((new Date(r.updatedAt).getTime() - new Date(r.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return {
      id: r.id,
      rfqCode: r.rfqCode,
      accountName: r.customer?.name || "—",
      priority: r.priority || "Normal",
      rfqStatus: r.status,
      rfqReceivedDate: r.receivedDate ? new Date(r.receivedDate).toISOString() : null,
      customerDueDate: r.customerDueDate ? new Date(r.customerDueDate).toISOString() : null,
      daysToQuote,
      linkedQuotationCode: r.quotations[0]?.quotationCode || null,
    };
  });

  return NextResponse.json({
    success: true,
    summary: { total, converted, conversionRate, overdueCount, avgTurnaroundDays },
    rfqs: formattedRfqs,
  });
}
