import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

const VALID_STATUS = ["Draft", "Sent", "Approved", "PO Received", "Cancelled"];

const EDITABLE_FIELDS = [
  "status",
  "notes",
  "paymentTerms",
  "deliveryTerms",
  "termsAndConditions",
  "irn",
  "ackNo",
  "ackDate",
  "ewayBillNo",
  "ewayBillDate",
  "customerPoNo",
  "customerPoDate",
  "despatchThrough",
  "vehicleNo",
  "placeOfSupply",
  "billName",
  "billAddress",
  "billState",
  "billStateCode",
  "billGstNumber",
  "billPhone",
  "shipName",
  "shipAddress",
  "shipState",
  "shipStateCode",
  "shipGstNumber",
  "shipPhone",
  "declaration",
  "preparedBy",
  "verifiedBy",
  "roundedOff",
  "transportCharge",
  "otherCharges",
  "weighingLoadingCharge",
  "deliveryCharge",
  "testingCharge",
  "discountPercent",
];

const NUMBER_FIELDS = [
  "roundedOff",
  "transportCharge",
  "otherCharges",
  "weighingLoadingCharge",
  "deliveryCharge",
  "testingCharge",
  "discountPercent",
];

const DATE_FIELDS = ["ackDate", "ewayBillDate", "customerPoDate"];

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
      quotation: { select: { id: true, quotationCode: true, transportCharge: true, otherCharges: true, weighingLoadingCharge: true, deliveryCharge: true, testingCharge: true, discountPercent: true, subtotal: true, taxAmount: true, finalAmount: true } },
      company: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, hsnCode: true } } } },
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

  const existing = await prisma.proformaInvoice.findFirst({
    where: { id, companyId: user.companyId },
    include: { customer: { select: { name: true } }, items: true },
  });

  if (!existing) {
    return NextResponse.json({ success: false, message: "Proforma not found" }, { status: 404 });
  }

  if (body.status !== undefined && !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ success: false, message: `Invalid status. Allowed: ${VALID_STATUS.join(", ")}` }, { status: 400 });
  }

  const data: any = {};
  const historyRows: any[] = [];

  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      let value = body[field];
      if (NUMBER_FIELDS.includes(field)) {
        value = parseFloat(value) || 0;
      } else if (DATE_FIELDS.includes(field)) {
        value = value ? new Date(value) : null;
      }

      if (value !== (existing as any)[field]) {
        data[field] = value;
        historyRows.push({
          proformaId: id,
          fieldName: field,
          previousValue: (existing as any)[field] == null ? null : String((existing as any)[field]),
          newValue: value == null ? null : String(value),
          changedById: user.id,
          notes: `Updated ${field}`,
        });
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: true, data: existing, message: "No changes" });
  }

  // Recalculate grandTotal based on stored subtotal/tax plus charges and roundedOff
  const discountPercent = data.discountPercent !== undefined ? data.discountPercent : existing.discountPercent;
  const roundedOff = data.roundedOff !== undefined ? data.roundedOff : existing.roundedOff;
  const transportCharge = data.transportCharge !== undefined ? data.transportCharge : existing.transportCharge;
  const otherCharges = data.otherCharges !== undefined ? data.otherCharges : existing.otherCharges;
  const weighingLoadingCharge = data.weighingLoadingCharge !== undefined ? data.weighingLoadingCharge : existing.weighingLoadingCharge;
  const deliveryCharge = data.deliveryCharge !== undefined ? data.deliveryCharge : existing.deliveryCharge;
  const testingCharge = data.testingCharge !== undefined ? data.testingCharge : existing.testingCharge;
  const extraCharges = transportCharge + otherCharges + weighingLoadingCharge + deliveryCharge + testingCharge;
  const discountAmount = existing.subtotal * (discountPercent / 100);
  const grandTotal = existing.subtotal - discountAmount + existing.taxAmount + extraCharges + roundedOff;
  data.grandTotal = grandTotal;

  await prisma.$transaction(async (tx) => {
    await tx.proformaInvoice.update({ where: { id }, data });
    if (historyRows.length > 0) {
      await tx.proformaInvoiceHistory.createMany({ data: historyRows });
    }
  });

  const updated = await prisma.proformaInvoice.findFirst({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, billingAddress: true, shippingAddress: true, city: true, state: true, gstNumber: true, phone: true, email: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      quotation: { select: { id: true, quotationCode: true, transportCharge: true, otherCharges: true, weighingLoadingCharge: true, deliveryCharge: true, testingCharge: true, discountPercent: true, subtotal: true, taxAmount: true, finalAmount: true } },
      company: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, hsnCode: true } } } },
      histories: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: "desc" }, take: 50 },
      SalesOrder: { select: { id: true, orderNumber: true, status: true } },
    },
  });

  return NextResponse.json({ success: true, data: updated, message: "Proforma updated" });
}
