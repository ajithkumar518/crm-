import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { logEvent } from "@/lib/activity-event";
import { computeOverallMarginPercent } from "@/lib/quotation-margins";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const paymentTerms = searchParams.get("paymentTerms");
  const assignedUserId = searchParams.get("assignedUserId");
  const customerCategory = searchParams.get("customerCategory");
  const quantityWiseCategory = searchParams.get("quantityWiseCategory");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {
    deletedAt: null,
    companyId: user.companyId,
  };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (assignedUserId) where.assignedUserId = assignedUserId;
  if (paymentTerms) where.paymentTerms = { contains: paymentTerms };
  if (customerCategory) where.customer = { customerCategory };
  if (quantityWiseCategory) where.quantityWiseCategory = quantityWiseCategory;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }

  const [rawQuotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true, customerCategory: true } },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            costBasisUnitPrice: true,
            description: true,
            materialGrade: true,
            materialSize: true,
            lengthMm: true,
            numberOfPieces: true,
            product: { select: { id: true, name: true, productCode: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quotation.count({ where }),
  ]);

  const quotations = rawQuotations.map((q) => {
    const totalQuantity = q.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const overallMarginPercent = computeOverallMarginPercent(
      q.items.map((it) => ({
        quantity: it.quantity || 0,
        unitPrice: it.unitPrice || 0,
        costBasisUnitPrice: it.costBasisUnitPrice != null ? Number(it.costBasisUnitPrice) : null,
      }))
    );
    return { ...q, totalQuantity, overallMarginPercent };
  });

  return NextResponse.json({ success: true, data: quotations, total, page, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Please log in to create a quotation" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Customer accounts cannot create quotations" }, { status: 403 });

  const body = await request.json();

  // Validate customer
  if (!body.customerId) {
    return NextResponse.json({ success: false, message: "Customer is required" }, { status: 400 });
  }

  // Validate validity date
  const validUntil = new Date(body.validUntil);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (validUntil < today) {
    return NextResponse.json({ success: false, message: "Validity date must be today or later" }, { status: 400 });
  }

  const discountPercent = parseFloat(body.discountPercent) || 0;
  const quantityWiseCategory = body.quantityWiseCategory || null;

  // If rfq_id provided, copy line items from RFQ with per-line-item costing
  let rfqLineItems: any[] = [];
  if (body.rfqId) {
    const rfq = await prisma.rFQ.findFirst({
      where: { id: body.rfqId, deletedAt: null, companyId: user.companyId },
      include: {
        lineItems: {
          include: {
            product: { select: { id: true, productCode: true, unit: true, hsnCode: true } },
            quantityBreaks: {
              include: {
                costingSheets: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            },
          },
          orderBy: { displayOrder: "asc" },
        },
      },
    });
    if (!rfq) {
      return NextResponse.json({ success: false, message: "RFQ not found" }, { status: 404 });
    }
    rfqLineItems = rfq.lineItems;
  }

  // Build items list: from body or from RFQ
  let items: any[];
  if (rfqLineItems.length > 0 && (!body.items || body.items.length === 0)) {
    // Build from RFQ line items — use per-quantity-break costing sheets
    items = [];
    for (const li of rfqLineItems) {
      if (li.quantityBreaks && li.quantityBreaks.length > 0) {
        for (const qb of li.quantityBreaks) {
          const costing = qb.costingSheets?.[0];
          if (costing) {
            const costBasis = costing.marginPercent > 0
              ? costing.computedUnitPrice / (1 + costing.marginPercent / 100)
              : costing.computedUnitPrice;
            items.push({
              productId: li.productId || null,
              description: `${li.itemDescription} (Tier: ${qb.quantity} qty)`,
              quantity: qb.quantity,
              unitPrice: costing.computedUnitPrice,
              discountPercent: 0,
              taxPercent: 18,
              hsn: li.product?.hsnCode || li.product?.productCode || null,
              unit: li.unit || "Pcs",
              costBasisUnitPrice: costBasis,
              marginPercent: costing.marginPercent,
              priceSource: "RFQCosting",
              quantityBreakId: qb.id,
            });
          }
        }
      } else {
        // No quantity breaks — use line item primary quantity with zero price
        items.push({
          productId: li.productId || null,
          description: li.itemDescription,
          quantity: li.quantity,
          unitPrice: 0,
          discountPercent: 0,
          taxPercent: 18,
          hsn: li.product?.hsnCode || li.product?.productCode || null,
          unit: li.unit || "Pcs",
        });
      }
    }
  } else {
    items = body.items || [];
  }

  if (items.length === 0) {
    return NextResponse.json({ success: false, message: "At least 1 line item is required" }, { status: 400 });
  }

  // ── SERVER-COMPUTE ALL TOTALS ──
  let subtotal = 0;
  let taxAmount = 0;

  const computedItems = items.map((item: any) => {
    const qty = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const lineDiscount = parseFloat(item.discountPercent) || 0;
    const taxPercent = parseFloat(item.taxPercent) || 18;
    const cuttingCharge = parseFloat(item.cuttingCharge) || 0;

    const lineTotal = qty * unitPrice * (1 - lineDiscount / 100);
    const lineTax = lineTotal * (taxPercent / 100);

    subtotal += lineTotal;
    taxAmount += lineTax;

    // Preserve cost basis fields if provided (from RFQ costing)
    const costBasisUnitPrice = item.costBasisUnitPrice != null ? parseFloat(item.costBasisUnitPrice) : null;
    const marginPercent = costBasisUnitPrice != null && costBasisUnitPrice > 0 && unitPrice > 0
      ? ((unitPrice - costBasisUnitPrice) / unitPrice) * 100
      : null;
    const priceSource = item.priceSource || (costBasisUnitPrice != null ? "RFQCosting" : "StandaloneManual");

    return {
      productId: item.productId || null,
      description: item.description,
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      discountPercent: lineDiscount,
      taxPercent,
      lineTotal,
      cuttingCharge,
      hsn: item.hsn || null,
      unit: item.unit || null,
      notes: item.notes || null,
      costBasisUnitPrice,
      marginPercent,
      priceSource,
      quantityBreakId: item.quantityBreakId || null,
      // SUKI steel-specific fields
      productType: item.productType || null,
      materialGrade: item.materialGrade || null,
      materialSize: item.materialSize || null,
      lengthMm: item.length != null ? parseFloat(item.length) : null,
      numberOfPieces: item.numberOfPieces != null ? parseInt(item.numberOfPieces) : null,
      rmMake: item.rmMake || null,
      deliveryDays: item.deliveryDays != null ? parseInt(item.deliveryDays) : null,
      remarks: item.remarks || null,
    };
  });

  const totalCutting = computedItems.reduce((sum: number, it: any) => sum + (it.cuttingCharge || 0), 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const transportCharge = parseFloat(body.transportCharge) || 0;
  const otherCharges = parseFloat(body.otherCharges) || 0;
  const weighingLoadingCharge = parseFloat(body.weighingLoadingCharge) || 0;
  const deliveryCharge = parseFloat(body.deliveryCharge) || 0;
  const testingCharge = parseFloat(body.testingCharge) || 0;
  const extraCharges = transportCharge + otherCharges + weighingLoadingCharge + deliveryCharge + testingCharge;
  const grandTotal = subtotal - discountAmount + taxAmount + totalCutting + extraCharges;

  // Generate quotation code: QT-YYYY-NNNNN
  const year = new Date().getFullYear();
  const yearCount = await prisma.quotation.count({
    where: {
      quotationCode: { startsWith: `QT-${year}-` },
    },
  });
  const quotationCode = `QT-${year}-${String(yearCount + 1).padStart(5, "0")}`;

  try {
    const quotation = await prisma.$transaction(async (tx) => {
      // 1. Resolve HSN and tax from product master for each item
      let totalTax = 0;
      for (const pi of computedItems) {
        let taxPercent = 18;
        let hsn = pi.hsn;

        if (pi.productId) {
          const prod = await tx.product.findUnique({
            where: { id: pi.productId },
            select: { hsnCode: true, productCode: true },
          });
          if (prod) {
            hsn = prod.hsnCode || hsn || prod.productCode;
          }
        }

        if (hsn) {
          const taxEntry = await tx.taxMaster.findFirst({
            where: { hsnCode: hsn, isActive: true },
          });
          if (taxEntry) taxPercent = taxEntry.taxPercent;
        }

        pi.hsn = hsn;
        pi.taxPercent = taxPercent;
        const lineTax = pi.lineTotal * (taxPercent / 100);
        totalTax += lineTax;
      }

      // Recalculate grand total with resolved tax and extra charges
      taxAmount = totalTax;
      const discountAmount = subtotal * (discountPercent / 100);
      const grandTotal = subtotal - discountAmount + taxAmount + totalCutting + extraCharges;

      const overallMarginPercent = computeOverallMarginPercent(
        computedItems.map((it: any) => ({ quantity: it.quantity, unitPrice: it.unitPrice, costBasisUnitPrice: it.costBasisUnitPrice }))
      );

      // 1. Create quotation
      const q = await tx.quotation.create({
        data: {
          quotationCode,
          rfqId: body.rfqId || null,
          customerId: body.customerId,
          contactId: body.contactId || null,
          dealId: body.dealId || null,
          leadId: body.leadId || null,
          validUntil,
          discountPercent,
          totalAmount: subtotal,
          subtotal,
          taxAmount,
          finalAmount: grandTotal,
          overallMarginPercent,
          termsAndConditions: body.termsAndConditions || null,
          paymentTerms: body.paymentTerms || null,
          deliveryTerms: body.deliveryTerms || null,
          freightTerms: body.freightTerms || null,
          leadTimeDays: body.leadTimeDays ? parseInt(body.leadTimeDays) : null,
          transportCharge,
          otherCharges,
          weighingLoadingCharge,
          deliveryCharge,
          testingCharge,
          revisionNumber: 1,
          status: "Draft",
          createdById: user.id,
          assignedUserId: body.assignedUserId || null,
          companyId: user.companyId,
          quantityWiseCategory,
        },
      });

      // 2. Create line items
      for (const item of computedItems) {
        await tx.quotationItem.create({
          data: { quotationId: q.id, ...item },
        });
      }

      // 3. Insert quotation_status_history
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: q.id,
          fromStatus: null,
          toStatus: "Draft",
          changedById: user.id,
          notes: "Quotation created",
        },
      });

      await logEvent(tx, {
        entityType: "Quotation",
        entityId: q.id,
        type: "quotation_created",
        fromStatus: null,
        toStatus: "Draft",
        actorId: user.id,
        metadata: { quotationCode: q.quotationCode, rfqId: body.rfqId || null, grandTotal },
      });

      return q;
    });

    const fullQuotation = await prisma.quotation.findUnique({
      where: { id: quotation.id },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
      },
    });

    await logAudit(user.id, "Quotation", "Create", `Created quotation ${quotationCode}`, {
      resourceId: quotation.id,
      newState: { quotationCode, customerId: body.customerId, subtotal, taxAmount, grandTotal, status: "Draft" },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: fullQuotation }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to create quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
