import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { resolveTaxTreatment, computeGstSplitDetailed } from "@/lib/gstState";

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
      customer: { select: { id: true, state: true, gstNumber: true } },
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

  const gstinConfig = await prisma.systemConfig.findUnique({ where: { key: "company_gstin" } });
  const companyGstin = gstinConfig?.value || null;
  const gstResult = resolveTaxTreatment(
    companyGstin,
    proforma.customer?.state,
    null,
    proforma.customer?.state,
    proforma.customer?.gstNumber,
    proforma.customer?.state,
  );

  const salesOrder = await prisma.$transaction(async (tx) => {
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    let headerTaxPercent = proforma.items[0]?.taxPercent || 18;
    const itemTaxes: any[] = [];
    for (const it of proforma.items) {
      const split = computeGstSplitDetailed(it.lineTotal, it.taxPercent, gstResult.treatment);
      itemTaxes.push({
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
        ...split,
        lineTotal: it.lineTotal,
        rmMake: it.rmMake,
        deliveryDays: it.deliveryDays,
        remarks: it.remarks,
      });
      totalTax += split.totalTax;
      totalCgst += split.cgst;
      totalSgst += split.sgst;
      totalIgst += split.igst;
    }

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
        taxAmount: totalTax,
        taxType: gstResult.treatment,
        cgstPercent: gstResult.treatment === "intra_state" ? headerTaxPercent / 2 : 0,
        sgstPercent: gstResult.treatment === "intra_state" ? headerTaxPercent / 2 : 0,
        igstPercent: gstResult.treatment === "inter_state" ? headerTaxPercent : 0,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        igstAmount: totalIgst,
        discountPercent: proforma.discountPercent,
        grandTotal: proforma.grandTotal,
        notes: "Generated from proforma invoice",
        createdById: user.id,
        companyId: user.companyId,
      },
    });

    for (const it of itemTaxes) {
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
          cgstPercent: it.cgstPercent,
          sgstPercent: it.sgstPercent,
          igstPercent: it.igstPercent,
          cgstAmount: it.cgst,
          sgstAmount: it.sgst,
          igstAmount: it.igst,
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
