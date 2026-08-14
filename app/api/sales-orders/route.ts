import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const [data, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { companyId: user.companyId },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        proforma: { select: { id: true, proformaNumber: true } },
        quotation: { select: { id: true, quotationCode: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.salesOrder.count({ where: { companyId: user.companyId } }),
  ]);

  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}
