import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const salesOrder = await prisma.salesOrder.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, customerCategory: true, billingAddress: true, shippingAddress: true, city: true, state: true, gstNumber: true, phone: true, email: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      proforma: { select: { id: true, proformaNumber: true } },
      quotation: { select: { id: true, quotationCode: true } },
      company: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  if (!salesOrder) return NextResponse.json({ success: false, message: "Sales order not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: salesOrder });
}
