import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const companyId = user.companyId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalLeadsReceived,
    newLeads,
    quotationsSent,
    followUpPending,
    acceptedQuotations,
    rejectedQuotations,
    convertedCustomers,
    pendingSupplierRateChecking,
    materialNotAvailable,
    noStock,
    totalQuotations,
  ] = await Promise.all([
    prisma.lead.count({ where: { companyId, deletedAt: null } }),
    prisma.lead.count({ where: { companyId, deletedAt: null, createdAt: { gte: startOfMonth } } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Quotation Sent" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Follow-up" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Accepted" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Rejected" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Converted to Customer" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Supplier Rate Checking" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "Material Not Available" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null, status: "No Stock" } }),
    prisma.quotation.count({ where: { companyId, deletedAt: null } }),
  ]);

  const monthlyLeads = await prisma.lead.groupBy({
    by: ["status"],
    where: { companyId, deletedAt: null, createdAt: { gte: startOfMonth } },
    _count: { status: true },
  });

  const monthlyConverted = convertedCustomers;
  const monthlyTotal = monthlyLeads.reduce((sum, m) => sum + m._count.status, 0);

  const executivePerformance = await prisma.customer.groupBy({
    by: ["assignedUserId"],
    where: { companyId, deletedAt: null },
    _count: { id: true },
  });

  const users = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true },
  });

  const executivePerformanceWithNames = executivePerformance.map((e) => ({
    name: users.find((u) => u.id === e.assignedUserId)?.name || e.assignedUserId || "Unassigned",
    count: e._count.id,
  }));

  const leadSourcePerformance = await prisma.lead.groupBy({
    by: ["leadSource"],
    where: { companyId, deletedAt: null },
    _count: { id: true },
  });

  const statusCounts = await prisma.quotation.groupBy({
    by: ["status"],
    where: { companyId, deletedAt: null },
    _count: { status: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      totalLeadsReceived,
      newLeads,
      quotationsSent,
      followUpPending,
      acceptedQuotations,
      rejectedQuotations,
      convertedCustomers,
      pendingSupplierRateChecking,
      materialNotAvailable,
      noStock,
      totalQuotations,
      conversionRatio: monthlyTotal > 0 ? ((monthlyConverted / monthlyTotal) * 100).toFixed(2) : "0.00",
      executivePerformance: executivePerformanceWithNames,
      leadSourcePerformance: leadSourcePerformance.map((s) => ({ name: s.leadSource, count: s._count.id })),
      quotationStatusCounts: statusCounts.map((s) => ({ name: s.status, count: s._count.status })),
    },
  });
}
