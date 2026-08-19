import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";
import { transitionDealStatus } from "@/lib/dealService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (!["Quotation Sent", "UnderReview", "Follow-up", "Revised Rate", "Price Pending", "Supplier Rate Checking"].includes(existing.status)) {
    return NextResponse.json({ success: false, message: "Only active quotations can be rejected" }, { status: 400 });
  }

  // Determine the outcome status (defaults to "Rejected" for backward compat)
  const outcomeStatus = body.outcomeStatus || "Rejected";
  const VALID_OUTCOMES = ["Rejected", "MOQ", "Material Not Available", "No Stock", "Price Pending", "Supplier Rate Checking", "Others"];
  if (!VALID_OUTCOMES.includes(outcomeStatus)) {
    return NextResponse.json({ success: false, message: `Invalid outcome status. Allowed: ${VALID_OUTCOMES.join(", ")}` }, { status: 400 });
  }

  // Require rejection_reason_id for "Rejected" outcome
  if (outcomeStatus === "Rejected" && !body.rejectionReasonId) {
    return NextResponse.json({ success: false, message: "Rejection reason is required for Rejected status" }, { status: 400 });
  }

  try {
    const quotation = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: {
          status: outcomeStatus,
          rejectedAt: new Date(),
          rejectionReason: body.rejectionReasonText || null,
          rejectionReasonId: body.rejectionReasonId || null,
        },
      });

      await tx.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status,
          toStatus: outcomeStatus,
          changedById: user.id,
          notes: body.rejectionReasonText || `Status changed to ${outcomeStatus}`,
        },
      });

      // Close active negotiations
      const activeNegotiations = await tx.negotiation.findMany({
        where: {
          quotationId: id,
          status: { in: ["Active", "PriceRevision", "CommercialDiscussion", "PendingApproval"] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (activeNegotiations.length > 0) {
        await tx.negotiation.updateMany({
          where: { id: { in: activeNegotiations.map(n => n.id) } },
          data: { status: "Closed-Failure", outcome: "Lost", closedAt: new Date() },
        });
      }

      // Transition linked deal to Lost (consistent with negotiation-cascade behavior)
      if (existing.dealId) {
        await transitionDealStatus(existing.dealId, "Lost", {
          actorId: user.id,
          companyId: user.companyId!,
          reason: body.rejectionReasonText || `Quotation ${existing.quotationCode} rejected`,
        }, tx);
      }

      return q;
    });

    await logAudit(user.id, "Quotation", "Reject", `Quotation ${existing.quotationCode} marked as ${outcomeStatus}: ${body.rejectionReasonText || body.rejectionReasonId || ""}`, {
      resourceId: id,
      previousState: { status: existing.status },
      newState: { status: outcomeStatus, rejectionReasonId: body.rejectionReasonId },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: quotation });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to reject quotation: ${error.message}` },
      { status: 500 }
    );
  }
}
