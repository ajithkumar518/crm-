import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      contact: { select: { id: true } },
      items: {
        include: { product: { select: { id: true, name: true, productCode: true } } },
      },
    },
  });

  if (!quotation) {
    console.log("Proforma generation failed - quotation not found for id:", id, "user companyId:", user.companyId);
    return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });
  }

  if (quotation.status !== "Accepted" && quotation.status !== "Converted to Customer") {
    console.log("Proforma generation blocked - quotation status:", quotation.status);
    return NextResponse.json({ success: false, message: `Proforma can only be generated from an accepted quotation. Current status: ${quotation.status}` }, { status: 400 });
  }

  const existing = await prisma.proformaInvoice.findUnique({
    where: { quotationId: id },
    select: { id: true, proformaNumber: true },
  });
  if (existing) {
    return NextResponse.json({ success: true, data: existing, message: "Proforma already exists" }, { status: 200 });
  }

  const year = new Date().getFullYear();
  const lastProforma = await prisma.proformaInvoice.findFirst({
    where: { proformaNumber: { startsWith: `PF-${year}-` } },
    orderBy: { proformaNumber: "desc" },
    select: { proformaNumber: true },
  });
  const lastSuffix = lastProforma?.proformaNumber
    ? (parseInt(lastProforma.proformaNumber.split("-").pop() || "0") || 0)
    : 0;
  const proformaNumber = `PF-${year}-${String(lastSuffix + 1).padStart(5, "0")}`;

  const proforma = await prisma.$transaction(async (tx) => {
    const pf = await tx.proformaInvoice.create({
      data: {
        proformaNumber,
        quotationId: quotation.id,
        customerId: quotation.customerId,
        contactId: quotation.contactId,
        status: "Draft",
        proformaDate: new Date(),
        validityDate: quotation.validUntil,
        paymentTerms: quotation.paymentTerms,
        deliveryTerms: quotation.deliveryTerms,
        subtotal: quotation.subtotal,
        taxAmount: quotation.taxAmount,
        discountPercent: quotation.discountPercent,
        transportCharge: quotation.transportCharge || 0,
        otherCharges: quotation.otherCharges || 0,
        weighingLoadingCharge: quotation.weighingLoadingCharge || 0,
        deliveryCharge: quotation.deliveryCharge || 0,
        testingCharge: quotation.testingCharge || 0,
        grandTotal: quotation.finalAmount,
        termsAndConditions: `1. All reports shortage must reach within 3 days and about defective supply if any within 10 days from date of delivery in writing no claim will be acceptable by us thereafter.\n2. Rejection of material will be acceptable only in original shape of out supply (not after machining & cutting hardening)\n3. All disputes are subject to Chennai Jurisdiction only.\n4. Interest @24% will be charged on all over due bills.`,
        declaration: `Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and that there is no flow of additional consideration directly or indirectly from the buyer.`,
        notes: "Generated from quotation",
        createdById: user.id,
        companyId: user.companyId,
      },
    });

    for (const it of quotation.items) {
      await tx.proformaInvoiceItem.create({
        data: {
          proformaId: pf.id,
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
          cuttingCharge: it.cuttingCharge,
          rmMake: it.rmMake,
          deliveryDays: it.deliveryDays,
          remarks: it.remarks,
        },
      });
    }

    return pf;
  });

  const full = await prisma.proformaInvoice.findUnique({
    where: { id: proforma.id },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  return NextResponse.json({ success: true, data: full }, { status: 201 });
}
