import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

/**
 * PATCH /api/proforma-invoices/[id]/items
 *
 * Edits one or more line items on a Proforma Invoice.
 *
 * Body shape:
 *   { items: Array<{ id: string, quantity?, unitPrice?, discountPercent?, taxPercent?, remarks?, description?, cuttingCharge?, deliveryDays? }> }
 *
 * Rules:
 *  - If a Sales Order has been created from this Proforma, edits are BLOCKED with a clear message.
 *  - On success: lineTotal, subtotal, taxAmount, and grandTotal are recalculated.
 *  - Each changed field is recorded in ProformaInvoiceHistory for audit trail.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const itemsPayload: any[] = Array.isArray(body.items) ? body.items : [];

  if (itemsPayload.length === 0) {
    return NextResponse.json({ success: false, message: "No items provided" }, { status: 400 });
  }

  const proforma = await prisma.proformaInvoice.findFirst({
    where: { id, companyId: user.companyId },
    include: { items: true, SalesOrder: { select: { id: true, orderNumber: true } } },
  });

  if (!proforma) {
    return NextResponse.json({ success: false, message: "Proforma not found" }, { status: 404 });
  }

  // Block edits if a Sales Order has been created from this Proforma
  if (proforma.SalesOrder) {
    return NextResponse.json(
      {
        success: false,
        message: `Cannot edit line items: Sales Order ${proforma.SalesOrder.orderNumber} has already been created from this Proforma. Edit the Sales Order directly instead.`,
      },
      { status: 409 },
    );
  }

  const historyRows: any[] = [];
  const updatedItems: any[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Apply per-item updates and collect history rows
      for (const patch of itemsPayload) {
        if (!patch.id) continue;
        const existingItem = proforma.items.find((it) => it.id === patch.id);
        if (!existingItem) {
          throw new Error(`Line item ${patch.id} not found on this proforma`);
        }

        const updateData: any = {};
        const trackedFields: Array<keyof typeof existingItem> = [
          "quantity",
          "unitPrice",
          "discountPercent",
          "taxPercent",
          "remarks",
          "description",
          "cuttingCharge",
          "deliveryDays",
        ];

        for (const field of trackedFields) {
          if (patch[field] !== undefined) {
            const newValue = field === "deliveryDays" ? (patch[field] === null ? null : parseInt(patch[field])) : patch[field];
            const prevValue = (existingItem as any)[field];
            if (newValue !== prevValue) {
              updateData[field] = newValue;
              historyRows.push({
                proformaId: id,
                proformaItemId: existingItem.id,
                fieldName: String(field),
                previousValue: prevValue == null ? null : String(prevValue),
                newValue: newValue == null ? null : String(newValue),
                changedById: user.id,
                notes: `Edited line item "${existingItem.description}"`,
              });
            }
          }
        }

        if (Object.keys(updateData).length === 0) continue;

        // Recalculate lineTotal for this item
        const qty = updateData.quantity !== undefined ? parseFloat(updateData.quantity) || 0 : existingItem.quantity;
        const price = updateData.unitPrice !== undefined ? parseFloat(updateData.unitPrice) || 0 : existingItem.unitPrice;
        const disc = updateData.discountPercent !== undefined ? parseFloat(updateData.discountPercent) || 0 : existingItem.discountPercent;
        const cutting = updateData.cuttingCharge !== undefined ? (updateData.cuttingCharge === null ? 0 : parseFloat(updateData.cuttingCharge) || 0) : (existingItem.cuttingCharge || 0);
        const lineTotal = qty * price * (1 - disc / 100) + cutting;
        updateData.lineTotal = lineTotal;

        const updated = await tx.proformaInvoiceItem.update({
          where: { id: existingItem.id },
          data: updateData,
        });
        updatedItems.push(updated);
      }

      // 2. Recalculate proforma totals from all items
      const allItems = await tx.proformaInvoiceItem.findMany({ where: { proformaId: id } });
      let subtotal = 0;
      let taxAmount = 0;
      for (const it of allItems) {
        const lineTaxable = it.lineTotal;
        subtotal += lineTaxable;
        taxAmount += lineTaxable * ((it.taxPercent || 0) / 100);
      }
      const discountAmount = subtotal * (proforma.discountPercent / 100);
      const grandTotal = subtotal - discountAmount + taxAmount;

      await tx.proformaInvoice.update({
        where: { id },
        data: { subtotal, taxAmount, grandTotal },
      });

      // 3. Write history rows
      if (historyRows.length > 0) {
        await tx.proformaInvoiceHistory.createMany({ data: historyRows });
      }

      return { subtotal, taxAmount, grandTotal, updatedItems };
    });

    await logAudit(
      user.id,
      "ProformaInvoice",
      "Update",
      `Edited ${updatedItems.length} line item(s) on proforma ${proforma.proformaNumber}`,
      {
        resourceId: id,
        newState: { itemsEdited: updatedItems.length, subtotal: result.subtotal, taxAmount: result.taxAmount, grandTotal: result.grandTotal },
        context: extractAuditContext(request),
      },
    );

    const refreshed = await prisma.proformaInvoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
        histories: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: "desc" }, take: 20 },
      },
    });

    return NextResponse.json({
      success: true,
      data: refreshed,
      message: `Updated ${updatedItems.length} item(s). Totals recalculated.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || "Failed to update items" }, { status: 500 });
  }
}
