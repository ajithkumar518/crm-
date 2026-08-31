import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const proforma = await prisma.proformaInvoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: { select: { id: true } },
      contact: { select: { id: true } },
      quotation: { select: { id: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });

  if (!proforma) return NextResponse.json({ success: false, message: "Proforma not found" }, { status: 404 });

  if (proforma.status !== "Approved" && proforma.status !== "PO Received") {
    return NextResponse.json({ success: false, message: "Sales order can only be created from Approved or PO Received proforma" }, { status: 400 });
  }

  const existing = await prisma.salesOrder.findUnique({
    where: { proformaId: id },
    select: { id: true, orderNumber: true },
  });
  if (existing) {
    return NextResponse.json({ success: true, data: existing, message: "Sales order already exists" }, { status: 200 });
  }

  const year = new Date().getFullYear();
  const yearCount = await prisma.salesOrder.count({
    where: { orderNumber: { startsWith: `SO-${year}-` } },
  });
  const orderNumber = `SO-${year}-${String(yearCount + 1).padStart(5, "0")}`;

  const salesOrder = await prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.create({
      data: {
        orderNumber,
        proformaId: proforma.id,
        quotationId: proforma.quotationId,
        customerId: proforma.customerId,
        contactId: proforma.contactId,
        status: "Open",
        orderDate: new Date(),
        expectedDeliveryDate: proforma.validityDate,
        paymentTerms: proforma.paymentTerms,
        deliveryTerms: proforma.deliveryTerms,
        subtotal: proforma.subtotal,
        taxAmount: proforma.taxAmount,
        discountPercent: proforma.discountPercent,
        grandTotal: proforma.grandTotal,
        notes: "Generated from proforma invoice",
        createdById: user.id,
        companyId: user.companyId,
      },
    });

    for (const it of proforma.items) {
      await tx.salesOrderItem.create({
        data: {
          salesOrderId: so.id,
          productId: it.productId,
          description: it.description,
          productType: it.productType,
          materialGrade: it.materialGrade,
          materialSize: it.materialSize,
          lengthMm: it.lengthMm,
          numberOfPieces: it.numberOfPieces,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          taxPercent: it.taxPercent,
          lineTotal: it.lineTotal,
          rmMake: it.rmMake,
          deliveryDays: it.deliveryDays,
          remarks: it.remarks,
        },
      });
    }

    return so;
  });

  return NextResponse.json({ success: true, data: salesOrder, message: "Sales order created" }, { status: 201 });
}
