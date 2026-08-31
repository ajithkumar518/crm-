import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// POST /api/accounts/merge
// Admin/SuperAdmin only. Merges source account into target account.
// Moves all child records (contacts, deals, rfqs, quotations, visits, etc.) to target,
// then soft-deletes the source account.
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || (user.role !== "Admin" && user.role !== "SuperAdmin")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Only Admins can merge accounts" },
        { status: 403 }
      );
    }

    const { sourceId, targetId } = await request.json();

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { success: false, message: "sourceId and targetId are required" },
        { status: 400 }
      );
    }

    if (sourceId === targetId) {
      return NextResponse.json(
        { success: false, message: "Cannot merge an account into itself" },
        { status: 400 }
      );
    }

    const [source, target] = await Promise.all([
      prisma.customer.findUnique({ where: { id: sourceId, deletedAt: null } }),
      prisma.customer.findUnique({ where: { id: targetId, deletedAt: null } }),
    ]);

    if (!source) {
      return NextResponse.json({ success: false, message: "Source account not found" }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ success: false, message: "Target account not found" }, { status: 404 });
    }

    // Use a transaction to move all child records
    await prisma.$transaction(async (tx) => {
      // Move contacts
      await tx.contact.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move deals
      await tx.deal.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move RFQs
      await tx.rFQ.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move quotations
      await tx.quotation.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move customer visits
      await tx.customerVisit.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move marketing visits
      await tx.marketingVisit.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move subscriptions
      await tx.subscription.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move call logs
      await tx.callLog.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move follow-ups
      await tx.followUp.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move plant locations
      await tx.plantLocation.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move account status history
      await tx.accountStatusHistory.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Move account credit history
      await tx.accountCreditHistory.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Soft-delete the source account
      await tx.customer.update({
        where: { id: sourceId },
        data: {
          deletedAt: new Date(),
          deletedById: user.id,
        },
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          userId: user.id,
          module: "Customer",
          action: "MERGE_ACCOUNT",
          details: `Merged account ${source.customerCode} (${source.name}) into ${target.customerCode} (${target.name})`,
          resourceId: targetId,
          companyId: user.companyId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Account "${source.name}" merged into "${target.name}" successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
