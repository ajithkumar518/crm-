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
  if (quotationId) where.OR = [{ quotationId }, { sourceQuotationId: quotationId }];
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

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { quotationId } = body;

  if (!quotationId) {
    return NextResponse.json({ success: false, message: "Quotation ID is required" }, { status: 400 });
  }

  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, billingAddress: true, shippingAddress: true, state: true, gstNumber: true, phone: true, email: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      company: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, productCode: true, hsnCode: true } } },
      },
    },
  });

  if (!quotation) {
    return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });
  }

  if (quotation.status !== "Approved") {
    return NextResponse.json({ success: false, message: "Quotation must be Approved to create a Draft Proforma" }, { status: 400 });
  }

  const customer = quotation.customer;
  const proformaNumber = `DPI-${quotation.quotationCode}-${Date.now()}`;

  const copiedItems = quotation.items.map((it) => {
    const lineTotal = it.quantity * it.unitPrice * (1 - (it.discountPercent || 0) / 100) + (it.cuttingCharge || 0);
    return {
      productId: it.productId,
      description: it.description,
      hsn: it.hsn,
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
      lineTotal,
      rmMake: it.rmMake,
      deliveryDays: it.deliveryDays,
      cuttingCharge: it.cuttingCharge,
      remarks: it.remarks,
    };
  });

  const subtotal = copiedItems.reduce((s, it) => s + it.lineTotal, 0);
  const taxAmount = copiedItems.reduce((s, it) => s + it.lineTotal * ((it.taxPercent || 0) / 100), 0);
  const discountPercent = quotation.discountPercent || 0;
  const discountAmount = subtotal * (discountPercent / 100);
  const extraCharges =
    (quotation.transportCharge || 0) +
    (quotation.otherCharges || 0) +
    (quotation.weighingLoadingCharge || 0) +
    (quotation.deliveryCharge || 0) +
    (quotation.testingCharge || 0);
  const grandTotal = subtotal - discountAmount + taxAmount + extraCharges;

  const created = await prisma.proformaInvoice.create({
    data: {
      proformaNumber,
      customerId: quotation.customerId,
      contactId: quotation.contactId,
      companyId: quotation.companyId,
      createdById: user.id,
      status: "Draft",
      proformaDate: new Date(),
      validityDate: quotation.validUntil,
      paymentTerms: quotation.paymentTerms,
      deliveryTerms: quotation.deliveryTerms,
      termsAndConditions: `1.All reports shortage must reach within 3 days and about defective supply if any within 10 days from date of delivery in writing no claim will be acceptable by us thereafter.
2.Rejection of material will be acceptable only in original shape of out supply )not after machining & cutting hardening)
3.All disputes are subject to Chennai Jurisdiction only.
4.Interest @24% will be charged on all over due bills.`,
      declaration: `Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and that there s no flow additional consideration directly or indirectly from the buyer.`,
      sourceQuotationId: quotation.id,
      sourceQuotationNumber: quotation.quotationCode,
      quotationId: null,
      subtotal,
      taxAmount,
      discountPercent,
      grandTotal,
      roundedOff: 0,
      transportCharge: quotation.transportCharge || 0,
      otherCharges: quotation.otherCharges || 0,
      weighingLoadingCharge: quotation.weighingLoadingCharge || 0,
      deliveryCharge: quotation.deliveryCharge || 0,
      testingCharge: quotation.testingCharge || 0,
      billName: customer?.name || "",
      billAddress: customer?.billingAddress || "",
      billState: customer?.state || "",
      billStateCode: customer?.gstNumber ? customer.gstNumber.substring(0, 2) : "",
      billGstNumber: customer?.gstNumber || "",
      billPhone: customer?.phone || "",
      shipName: customer?.name || "",
      shipAddress: customer?.shippingAddress || customer?.billingAddress || "",
      shipState: customer?.state || "",
      shipStateCode: customer?.gstNumber ? customer.gstNumber.substring(0, 2) : "",
      shipGstNumber: customer?.gstNumber || "",
      shipPhone: customer?.phone || "",
      items: { create: copiedItems },
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      contact: { select: { id: true, name: true } },
      quotation: { select: { id: true, quotationCode: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  await prisma.proformaInvoiceHistory.create({
    data: {
      proformaId: created.id,
      fieldName: "created",
      newValue: `Draft created from quotation ${quotation.quotationCode}`,
      changedById: user.id,
      notes: `Copied ${copiedItems.length} line item(s) from approved quotation`,
    },
  });

  await logAudit(
    user.id,
    "ProformaInvoice",
    "Create",
    `Created draft proforma ${created.proformaNumber} from quotation ${quotation.quotationCode}`,
    { resourceId: created.id },
  );

  return NextResponse.json({ success: true, data: created, message: "Draft Proforma created" });
}

export async function DELETE(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ success: false, message: "Proforma ID is required" }, { status: 400 });
  }

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

  if (proforma.SalesOrder) {
    return NextResponse.json({ success: false, message: "Cannot delete proforma with linked sales order" }, { status: 400 });
  }

  try {
    await prisma.proformaInvoice.delete({ where: { id } });
    await logAudit(user.id, "proforma", "delete", `Deleted proforma ${proforma.proformaNumber}`);
    return NextResponse.json({ success: true, message: "Proforma deleted successfully" });
  } catch (error: any) {
    console.error("Delete proforma error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete proforma" }, { status: 500 });
  }
}
