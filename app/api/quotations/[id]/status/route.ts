import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

// Statuses that can be set manually via this endpoint (excluding auto-triggered ones)
const MANUAL_STATUSES = [
  "Revised Rate",
  "Price Pending",
  "Supplier Rate Checking",
  "Follow-up",
  "MOQ",
  "Material Not Available",
  "No Stock",
  "Others",
  "Rejected",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { status: newStatus, notes, rejectionReasonId, rejectionReasonText } = body;

  if (!newStatus || !MANUAL_STATUSES.includes(newStatus)) {
    return NextResponse.json(
      { success: false, message: `Invalid status. Allowed: ${MANUAL_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  if (existing.status === newStatus) {
    return NextResponse.json({ success: false, message: `Quotation is already in ${newStatus} status` }, { status: 400 });
  }

  try {
    const quotation = await prisma.$transaction(async (tx) => {
      const updateData: any = { status: newStatus };
      if (newStatus === "Rejected") {
        updateData.rejectedAt = new Date();
        updateData.rejectionReason = rejectionReasonText || null;
        updateData.rejectionReasonId = rejectionReasonId || null;
      }

      const q = await tx.quotation.update({
        where: { id },
        data: updateData,
      });

      await tx.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: existing.status,
          toStatus: newStatus,
          changedById: user.id,
          notes: notes || `Status changed to ${newStatus}`,
        },
      });

      // Close active negotiations for rejection-like outcomes
      const rejectionOutcomes = ["Rejected", "MOQ", "Material Not Available", "No Stock", "Others"];
      if (rejectionOutcomes.includes(newStatus)) {
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
            where: { id: { in: activeNegotiations.map((n) => n.id) } },
            data: { status: "Closed-Failure", outcome: "Lost", closedAt: new Date() },
          });
        }
      }

      return q;
    });

    await logAudit(user.id, "Quotation", "StatusChange", `Changed quotation ${existing.quotationCode} status from ${existing.status} to ${newStatus}`, {
      resourceId: id,
      previousState: { status: existing.status },
      newState: { status: newStatus },
      context: extractAuditContext(request),
    });

    return NextResponse.json({ success: true, data: quotation });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to update quotation status: ${error.message}` },
      { status: 500 }
    );
  }
}
