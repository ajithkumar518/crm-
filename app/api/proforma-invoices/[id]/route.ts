import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

const VALID_STATUS = ["Draft", "Sent", "Approved", "PO Received", "Cancelled"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const proforma = await prisma.proformaInvoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: {
        select: { id: true, name: true, customerCode: true, billingAddress: true, shippingAddress: true, city: true, state: true, gstNumber: true, phone: true, email: true },
      },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      quotation: { select: { id: true, quotationCode: true } },
      company: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
      histories: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { changedAt: "desc" },
        take: 50,
      },
      SalesOrder: { select: { id: true, orderNumber: true, status: true } },
    },
  });

  if (!proforma) {
    return NextResponse.json({ success: false, message: "Proforma not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: proforma });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status, notes } = body;

  const proforma = await prisma.proformaInvoice.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true },
  });

  if (!proforma) {
    return NextResponse.json({ success: false, message: "Proforma not found" }, { status: 404 });
  }

  const data: any = {};
  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ success: false, message: `Invalid status. Allowed: ${VALID_STATUS.join(", ")}` }, { status: 400 });
    }
    data.status = status;
  }
  if (notes !== undefined) data.notes = notes;

  const updated = await prisma.proformaInvoice.update({
    where: { id },
    data,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      quotation: { select: { id: true, quotationCode: true } },
    },
  });

  return NextResponse.json({ success: true, data: updated, message: "Proforma updated" });
}
