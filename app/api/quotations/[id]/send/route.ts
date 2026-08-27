import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { logEvent, logEventAsync } from "@/lib/activity-event";
import { hasModule } from "@/lib/modules";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";
import { sendEmail } from "@/lib/email";
import { generateSukiQuotationPdf } from "@/lib/generateSukiQuotationPdf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      items: { include: { product: { select: { productType: true } } } },
      customer: { select: { id: true, name: true, email: true, customerCode: true, billingAddress: true, shippingAddress: true, city: true, state: true, gstNumber: true, phone: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, dealName: true, opportunityCode: true } },
      company: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      quotationApprovals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (!["Draft", "Approved", "UnderReview"].includes(existing.status)) {
    return NextResponse.json({ success: false, message: "Only Draft, Approved, or UnderReview (post-revision) quotations can be sent" }, { status: 400 });
  }

  // If quotation is UnderReview, verify the linked negotiation has an approved revision (PriceRevision status)
  if (existing.status === "UnderReview" && existing.negotiationId) {
    const linkedNeg = await prisma.negotiation.findFirst({
      where: { id: existing.negotiationId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (linkedNeg && !["PriceRevision", "CommercialDiscussion"].includes(linkedNeg.status)) {
      return NextResponse.json(
        { success: false, message: `Cannot send quotation while negotiation is in ${linkedNeg.status} status. The revision must be approved first.` },
        { status: 400 }
      );
    }
  }

  if (existing.items.length === 0) {
    return NextResponse.json({ success: false, message: "Cannot send quotation without line items" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(existing.validUntil) < today) {
    return NextResponse.json({ success: false, message: "Validity date has passed — update before sending" }, { status: 400 });
  }

  // Fetch approval and floor matrices
  const [discountConfig, floorConfig] = await Promise.all([
    prisma.systemConfig.findFirst({ where: { key: "approval_matrix_discount_threshold" } }),
    prisma.systemConfig.findFirst({ where: { key: "quotation_margin_floor_percent" } }),
  ]);
  const discountThreshold = discountConfig ? parseFloat(discountConfig.value) : 5.0;
  const marginFloor = floorConfig ? parseFloat(floorConfig.value) : 15.0;

  // Compute realized weighted discount and evaluate triggers
  // Bug #10 fix: after applyNegotiationRevision, existing.subtotal is ALREADY the sum of
  // discounted totalPrice values and item.unitPrice is already discounted. The old code
  // re-applied discountPercent on subtotal (double-discount) and used discounted unitPrice
  // as "gross". Now: totalNet = subtotal (already net), and we try to recover original
  // gross from the round-0 snapshot. If no snapshot, we reverse-engineer from discountPercent.
  let totalGross = 0;
  let totalNet = existing.subtotal;

  // Try to recover original undiscounted prices from round-0 snapshot
  let originalPrices: Record<string, number> | null = null;
  if (existing.currentRound > 0) {
    const round0Snap = await prisma.quotationRevisionSnapshot.findFirst({
      where: { quotationId: existing.id, roundNumber: 0 },
      orderBy: { createdAt: "asc" },
    });
    if (round0Snap) {
      try {
        const snap = JSON.parse(round0Snap.snapshotJson);
        if (snap.items && Array.isArray(snap.items)) {
          originalPrices = {};
          for (const snapItem of snap.items) {
            const matched = existing.items.find(
              (it: any) => it.description === snapItem.description && it.quantity === snapItem.quantity
            );
            if (matched && snapItem.unitPrice != null) {
              originalPrices[matched.id] = snapItem.unitPrice;
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  let maxLineDiscount = 0;
  let hasMarginBreach = false;
  const reasons: string[] = [];

  for (const item of existing.items) {
    const qty = item.quantity || 0;
    const unitPrice = item.unitPrice || 0;
    // Use original price if available, otherwise reverse-engineer from discount
    const grossUnitPrice = originalPrices?.[item.id] ?? (item.discountPercent > 0
      ? unitPrice / (1 - item.discountPercent / 100)
      : unitPrice);
    const gross = qty * grossUnitPrice;
    totalGross += gross;

    if (item.discountPercent > maxLineDiscount) {
      maxLineDiscount = item.discountPercent;
    }

    if (item.costBasisUnitPrice != null) {
      const costBasis = Number(item.costBasisUnitPrice);
      const margin = unitPrice > 0 ? ((unitPrice - costBasis) / unitPrice) * 100 : 0;
      if (margin < marginFloor) {
        hasMarginBreach = true;
      }
    }
  }

  const blendedDiscount = totalGross > 0 ? ((totalGross - totalNet) / totalGross) * 100 : 0;

  if (blendedDiscount > discountThreshold) {
    reasons.push(`Blended discount of ${blendedDiscount.toFixed(1)}% exceeds the ${discountThreshold}% threshold`);
  }
  if (maxLineDiscount > discountThreshold) {
    reasons.push(`Line-item discount ceiling of ${maxLineDiscount.toFixed(1)}% exceeds the ${discountThreshold}% threshold`);
  }
  if (hasMarginBreach) {
    reasons.push(`One or more line items have margins falling below the minimum floor of ${marginFloor}%`);
  }

  const hasApprovedApproval = existing.quotationApprovals.some(
    (a: any) => a.status === "Approved"
  );

  // Only enforce the approval gate if the company has the approval_center module.
  // Without the module, triggers are informational only — send proceeds (per module-gating-plan.md: "Add-ons enrich, never block").
  const companyHasApprovalCenter = hasModule(user, MODULE_KEYS.APPROVAL_CENTER);

  if (companyHasApprovalCenter && reasons.length > 0 && !hasApprovedApproval && user.role !== "Admin") {
    return NextResponse.json(
      {
        success: false,
        requires_approval: true,
        reasons,
        message: `Quotation requires manager approval before sending. Reasons:\n- ${reasons.join("\n- ")}`,
      },
      { status: 402 }
    );
  }

  try {
    const quotation = await prisma.$transaction(async (tx) => {
      // 1. Update quotation status
      const q = await tx.quotation.update({
        where: { id },
        data: { status: "Quotation Sent", sentAt: new Date() },
      });

      // 2. Insert quotation_status_history
      const sendNotes = existing.status === "UnderReview"
        ? `Revised quotation (R${existing.currentRound}) re-sent to customer after negotiation revision approval.`
        : `Quotation sent to customer.${reasons.length > 0 ? " Approved override." : ""}`;
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status,
          toStatus: "Quotation Sent",
          changedById: user.id,
          notes: sendNotes,
        },
      });

      // 2a. If this was a re-send after revision, move negotiation to CommercialDiscussion
      if (existing.status === "UnderReview" && existing.negotiationId) {
        const neg = await tx.negotiation.findFirst({
          where: { id: existing.negotiationId },
          select: { id: true, status: true },
        });
        if (neg && neg.status === "PriceRevision") {
          await tx.negotiation.update({
            where: { id: neg.id },
            data: { status: "CommercialDiscussion" },
          });
          await logEvent(tx, {
            entityType: "Negotiation",
            entityId: neg.id,
            rootEntityId: id,
            type: "negotiation_status_changed",
            fromStatus: "PriceRevision",
            toStatus: "CommercialDiscussion",
            actorId: user.id,
            metadata: { reason: "Quotation re-sent to customer after revision approval" },
          });
        }
      }

      // 3. Create follow-up (Call, scheduled +2 days)
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 2);

      await tx.followUp.create({
        data: {
          assignedUserId: existing.assignedUserId || user.id,
          nextMeetingDate: followUpDate,
          remarks: `Auto-generated follow up for quotation ${existing.quotationCode}`,
          status: "Pending",
          customerId: existing.customerId,
          companyId: user.companyId,
          notes: `Auto-generated follow up for quotation ${existing.quotationCode} sent to ${existing.customer?.name || "Customer"}.`,
          stageAtCreation: "Deal",
        },
      });



      return q;
    });

    await logEventAsync({
      entityType: "Quotation",
      entityId: id,
      type: "quotation_sent",
      fromStatus: existing.status,
      toStatus: "Quotation Sent",
      actorId: user.id,
      metadata: { quotationCode: existing.quotationCode, finalAmount: existing.finalAmount },
    });

    await logAudit(user.id, "Quotation", "Send", `Sent quotation ${existing.quotationCode} to customer`, {
      resourceId: id,
      newState: { status: "Quotation Sent" },
      context: extractAuditContext(request),
    });

    // Notify assigned user if different from sender
    if (existing.assignedUserId && existing.assignedUserId !== user.id) {
      await dispatchNotification({
        userId: existing.assignedUserId,
        title: "Quotation Sent",
        message: `Quotation ${existing.quotationCode} has been sent to ${existing.customer?.name || "customer"}.`,
        type: "quotation",
        link: `/quotations/${id}`,
      }).catch(() => undefined);
    }

    // Notify customer contact if linked
    if (existing.contactId) {
      await dispatchNotification({
        userId: existing.contactId,
        title: "Quotation Received",
        message: `You have received quotation ${existing.quotationCode}. Total: ₹${existing.finalAmount.toFixed(2)}`,
        type: "quotation",
        link: `/quotations/${id}`,
      }).catch(() => undefined);
    }

    // ── Email PDF to customer (after transaction commits) ──
    let emailSent = false;
    let emailedTo: string | null = null;
    let emailWarning: string | null = null;

    // Resolve recipient email with fallback chain: Contact → Customer
    const recipientEmail =
      existing.contact?.email ||
      existing.customer?.email ||
      null;

    if (!recipientEmail) {
      emailWarning = "No recipient email found (contact or customer). Quotation status updated but email not sent.";
    } else {
      try {
        // Fetch company info for PDF header
        const [addrConfig, gstinConfig, phoneConfig, emailConfig] = await Promise.all([
          prisma.systemConfig.findUnique({ where: { key: "company_address" } }),
          prisma.systemConfig.findUnique({ where: { key: "company_gstin" } }),
          prisma.systemConfig.findUnique({ where: { key: "company_phone" } }),
          prisma.systemConfig.findUnique({ where: { key: "company_email" } }),
        ]);

        const generatedByName = (await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name || user.email;

        let doc;
        try {
          doc = generateSukiQuotationPdf({
          quotationCode: quotation.quotationCode,
          revisionNumber: quotation.revisionNumber,
          status: quotation.status,
          validUntil: quotation.validUntil,
          createdAt: quotation.createdAt,
          termsAndConditions: quotation.termsAndConditions,
          paymentTerms: quotation.paymentTerms,
          deliveryTerms: quotation.deliveryTerms,
          freightTerms: quotation.freightTerms,
          leadTimeDays: quotation.leadTimeDays,
          transportCharge: (quotation as any).transportCharge,
          otherCharges: (quotation as any).otherCharges,
          weighingLoadingCharge: (quotation as any).weighingLoadingCharge,
          deliveryCharge: (quotation as any).deliveryCharge,
          testingCharge: (quotation as any).testingCharge,
          customer: existing.customer as any,
          contact: existing.contact as any,
          company: existing.company as any,
          items: (existing.items as any[]).map((it) => ({ ...it, productType: it.product?.productType || it.productType })),
          companyAddress: addrConfig?.value || "",
          companyGstin: gstinConfig?.value || "",
          companyPhone: phoneConfig?.value || "",
          companyEmail: emailConfig?.value || "",
          generatedByName,
          placeOfSupply: (existing as any).placeOfSupply || existing.customer?.state || null,
          shipState: (existing as any).shipState || existing.customer?.state || null,
          shipGstNumber: (existing as any).shipGstNumber || existing.customer?.gstNumber || null,
        });
        } catch (err: any) {
          return NextResponse.json(
            {
              success: false,
              message: err?.message || "Cannot send quotation: GST tax treatment could not be determined. Set the customer's state or GSTIN first.",
            },
            { status: 422 }
          );
        }

        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
        const fileName = `${quotation.quotationCode}-R${quotation.revisionNumber}.pdf`;

        // Build branded HTML email body
        const htmlBody = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background-color:#0D2137;padding:20px;text-align:center;">
              <h2 style="color:#ffffff;margin:0;"> SUKI  Marketing CRM</h2>
            </div>
            <div style="padding:24px;">
              <p>Dear <strong>${existing.contact?.name || existing.customer?.name || "Customer"}</strong>,</p>
              <p>Please find attached the quotation <strong>${quotation.quotationCode}</strong> from <strong>${existing.company?.name || "SUKI Software"}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:15px;font-size:14px;">
                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Quotation Code</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">${quotation.quotationCode}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Final Amount</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">₹${quotation.finalAmount.toFixed(2)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Valid Until</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${new Date(quotation.validUntil).toLocaleDateString()}</td></tr>
              </table>
              <p style="margin-top:24px;color:#475569;font-size:14px;">Please review the attached PDF for full details. If you have any questions, feel free to reach out.</p>
              <p style="margin-top:24px;color:#475569;font-size:13px;">Regards,<br/>${generatedByName}<br/>${existing.company?.name || "SUKI Software"}</p>
            </div>
          </div>
        `;

        await sendEmail({
          to: recipientEmail,
          subject: `Quotation ${quotation.quotationCode} from ${existing.company?.name || "SUKI Software"}`,
          html: htmlBody,
          attachments: [{ filename: fileName, content: pdfBuffer, contentType: "application/pdf" }],
        });

        emailSent = true;
        emailedTo = recipientEmail;

        // Log communication attempt (success)
        await prisma.communicationLog.create({
          data: {
            channel: "Email",
            direction: "Outbound",
            status: "Quotation Sent",
            content: `Quotation ${quotation.quotationCode} emailed to ${recipientEmail}`,
            customerId: existing.customerId || null,
            dealId: existing.dealId || null,
            sentByUserId: user.id,
            sentAt: new Date(),
            companyId: user.companyId ?? null,
          },
        }).catch(() => {});
      } catch (emailErr: any) {
        emailWarning = `Failed to email quotation PDF: ${emailErr.message}`;
        // Log communication attempt (failure) — do NOT roll back quotation status
        await prisma.communicationLog.create({
          data: {
            channel: "Email",
            direction: "Outbound",
            status: "Failed",
            content: `Failed to email quotation ${quotation.quotationCode} to ${recipientEmail}: ${emailErr.message}`,
            customerId: existing.customerId || null,
            dealId: existing.dealId || null,
            sentByUserId: user.id,
            sentAt: new Date(),
            companyId: user.companyId ?? null,
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      data: quotation,
      emailSent,
      ...(emailedTo ? { emailedTo } : {}),
      ...(emailWarning ? { emailWarning } : {}),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to send quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
