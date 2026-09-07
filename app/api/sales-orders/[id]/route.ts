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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.salesOrder.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, status: true, erpSyncStatus: true },
  });

  if (!existing) return NextResponse.json({ success: false, message: "Sales order not found" }, { status: 404 });

  // Do not allow editing orders that have already been synced to ERP
  if (existing.erpSyncStatus === "Synced") {
    return NextResponse.json({ success: false, message: "Cannot edit a sales order already synced to ERP" }, { status: 400 });
  }

  const body = await request.json();

  // Only allow editing safe header fields before ERP sync
  const updateData: any = {};
  if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms || null;
  if (body.deliveryTerms !== undefined) updateData.deliveryTerms = body.deliveryTerms || null;
  if (body.expectedDeliveryDate !== undefined) {
    updateData.expectedDeliveryDate = body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null;
  }
  if (body.notes !== undefined) updateData.notes = body.notes || null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: false, message: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.salesOrder.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true, customerCode: true, customerCategory: true, billingAddress: true, shippingAddress: true, city: true, state: true, gstNumber: true, phone: true, email: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      proforma: { select: { id: true, proformaNumber: true } },
      quotation: { select: { id: true, quotationCode: true } },
      company: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  return NextResponse.json({ success: true, data: updated, message: "Sales order updated" });
}
