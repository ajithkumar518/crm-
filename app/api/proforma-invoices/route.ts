import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const quotationId = searchParams.get("quotationId");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const pageSize = 20;

  const where: any = { companyId: user.companyId };
  if (quotationId) where.quotationId = quotationId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { proformaNumber: { contains: search } },
      { quotation: { quotationCode: { contains: search } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.proformaInvoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        quotation: { select: { id: true, quotationCode: true } },
        SalesOrder: { select: { id: true, orderNumber: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.proformaInvoice.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function DELETE(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ success: false, message: "Proforma ID is required" }, { status: 400 });
  }

  // Check if proforma exists and user has access
  const proforma = await prisma.proformaInvoice.findUnique({
    where: { id },
    include: { SalesOrder: true },
  });

  if (!proforma) {
    return NextResponse.json({ success: false, message: "Proforma not found" }, { status: 404 });
  }

  if (proforma.companyId !== user.companyId) {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
  }

  // Prevent deletion if a sales order has been created
  if (proforma.SalesOrder) {
    return NextResponse.json({ success: false, message: "Cannot delete proforma with linked sales order" }, { status: 400 });
  }

  try {
    await prisma.proformaInvoice.delete({
      where: { id },
    });

    await logAudit(user.id, "proforma", "delete", `Deleted proforma ${proforma.proformaNumber}`);

    return NextResponse.json({ success: true, message: "Proforma deleted successfully" });
  } catch (error: any) {
    console.error("Delete proforma error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete proforma" }, { status: 500 });
  }
}
