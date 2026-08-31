import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { logEventAsync } from "@/lib/activity-event";

/**
 * POST /api/sales-orders/[id]/sync-erp
 *
 * Pushes the sales order to the configured ERP system.
 * Reads SUKI_ERP_API_URL and SUKI_ERP_API_KEY from environment — same
 * config keys used by the Purchase Order sync endpoint, so both flows
 * target the same ERP instance.
 *
 * On success: stores erpReferenceNumber, sets erpSyncStatus = "Synced",
 *   erpSyncedAt = now, and stores both erpPayload and erpResponse.
 * On failure: sets erpSyncStatus = "Failed", stores error in erpResponse.
 *
 * Mirrors app/api/purchase-orders/[id]/sync-erp/route.ts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const salesOrder = await prisma.salesOrder.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, email: true, phone: true, city: true, state: true, gstNumber: true, billingAddress: true, shippingAddress: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      proforma: { select: { id: true, proformaNumber: true } },
      quotation: { select: { id: true, quotationCode: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, unit: true } } } },
    },
  });

  if (!salesOrder) return NextResponse.json({ success: false, message: "Sales order not found" }, { status: 404 });

  // Only allow sync when SO is Confirmed (parallel to PO requiring Approved)
  if (salesOrder.status !== "Confirmed" && salesOrder.status !== "Open") {
    return NextResponse.json(
      { success: false, message: "Sales order must be in 'Open' or 'Confirmed' status before syncing to ERP" },
      { status: 400 }
    );
  }

  const erpApiUrl = process.env.SUKI_ERP_API_URL;
  const erpApiKey = process.env.SUKI_ERP_API_KEY;

  if (!erpApiUrl || !erpApiKey) {
    return NextResponse.json(
      { success: false, message: "ERP integration is not configured. Set SUKI_ERP_API_URL and SUKI_ERP_API_KEY in environment." },
      { status: 500 }
    );
  }

  // Build the ERP payload — mirrors PO payload shape, with SO-specific fields
  const erpPayload = {
    source: "SUKI-CRM",
    documentType: "SalesOrder",
    orderNumber: salesOrder.orderNumber,
    orderDate: salesOrder.orderDate,
    expectedDelivery: salesOrder.expectedDeliveryDate,
    customer: {
      code: salesOrder.customer.customerCode,
      name: salesOrder.customer.name,
      email: salesOrder.customer.email,
      phone: salesOrder.customer.phone,
      gstin: salesOrder.customer.gstNumber,
      billingAddress: salesOrder.customer.billingAddress,
      shippingAddress: salesOrder.customer.shippingAddress,
      city: salesOrder.customer.city,
      state: salesOrder.customer.state,
    },
    contact: salesOrder.contact
      ? {
          name: salesOrder.contact.name,
          email: salesOrder.contact.email,
          phone: salesOrder.contact.phone,
        }
      : null,
    proformaNumber: salesOrder.proforma?.proformaNumber || null,
    quotationCode: salesOrder.quotation?.quotationCode || null,
    lineItems: salesOrder.items.map((it) => ({
      productSku: it.product?.productCode || null,
      productName: it.product?.name || it.description,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
      unit: it.product?.unit || it.unit || null,
    })),
    totals: {
      subtotal: salesOrder.subtotal,
      taxAmount: salesOrder.taxAmount,
      discountPercent: salesOrder.discountPercent,
      grandTotal: salesOrder.grandTotal,
    },
    paymentTerms: salesOrder.paymentTerms,
    deliveryTerms: salesOrder.deliveryTerms,
    notes: salesOrder.notes,
    syncedAt: new Date().toISOString(),
    syncedBy: { id: user.id, email: user.email },
  };

  const payloadJson = JSON.stringify(erpPayload);

  try {
    // Mark as Pending before sending
    await prisma.salesOrder.update({
      where: { id },
      data: { erpSyncStatus: "Pending", erpPayload: payloadJson },
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const erpResponse = await fetch(`${erpApiUrl}/sales-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${erpApiKey}`,
        "X-Source": "SUKI-CRM",
      },
      body: payloadJson,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await erpResponse.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { raw: responseText };
    }

    if (erpResponse.ok) {
      const erpReferenceNumber =
        responseJson?.referenceNumber ||
        responseJson?.erpReference ||
        responseJson?.soReference ||
        responseJson?.id ||
        responseJson?.documentNumber ||
        null;

      const updated = await prisma.salesOrder.update({
        where: { id },
        data: {
          erpSyncStatus: "Synced",
          erpReference: erpReferenceNumber, // populate the existing erpReference field
          erpReferenceNumber,
          erpSyncedAt: new Date(),
          erpResponse: JSON.stringify(responseJson),
        },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
        },
      });

      await logAudit(user.id, "SalesOrder", "ERPSync", `Synced SO ${salesOrder.orderNumber} to ERP${erpReferenceNumber ? ` (ref: ${erpReferenceNumber})` : ""}`, {
        resourceId: id,
        newState: { erpSyncStatus: "Synced", erpReferenceNumber },
        context: extractAuditContext(request),
      });

      await logEventAsync({
        entityType: "SalesOrder",
        entityId: id,
        type: "erp_synced",
        actorId: user.id,
        metadata: { orderNumber: salesOrder.orderNumber, erpReferenceNumber },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: erpReferenceNumber
          ? `Successfully synced to ERP. Reference: ${erpReferenceNumber}`
          : "Successfully synced to ERP.",
      });
    } else {
      await prisma.salesOrder.update({
        where: { id },
        data: {
          erpSyncStatus: "Failed",
          erpResponse: JSON.stringify({ status: erpResponse.status, body: responseJson }),
        },
      });

      await logAudit(user.id, "SalesOrder", "ERPSyncFailed", `ERP sync failed for SO ${salesOrder.orderNumber} (HTTP ${erpResponse.status})`, {
        resourceId: id,
        newState: { erpSyncStatus: "Failed" },
        context: extractAuditContext(request),
      });

      await logEventAsync({
        entityType: "SalesOrder",
        entityId: id,
        type: "erp_sync_failed",
        actorId: user.id,
        metadata: { orderNumber: salesOrder.orderNumber, httpStatus: erpResponse.status },
      });

      return NextResponse.json(
        { success: false, message: `ERP returned status ${erpResponse.status}` },
        { status: 502 }
      );
    }
  } catch (error: any) {
    const errorMessage = error?.name === "AbortError" ? "ERP request timed out after 30s" : (error?.message || "Unknown error");

    await prisma.salesOrder.update({
      where: { id },
      data: {
        erpSyncStatus: "Failed",
        erpResponse: JSON.stringify({ error: errorMessage, type: error?.name }),
      },
    });

    await logAudit(user.id, "SalesOrder", "ERPSyncFailed", `ERP sync failed for SO ${salesOrder.orderNumber}: ${errorMessage}`, {
      resourceId: id,
      newState: { erpSyncStatus: "Failed" },
      context: extractAuditContext(request),
    });

    await logEventAsync({
      entityType: "SalesOrder",
      entityId: id,
      type: "erp_sync_failed",
      actorId: user.id,
      metadata: { orderNumber: salesOrder.orderNumber, error: errorMessage },
    });

    return NextResponse.json(
      { success: false, message: `ERP sync failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
