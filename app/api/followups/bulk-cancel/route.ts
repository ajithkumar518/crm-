import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// POST /api/follow-ups/bulk-cancel
// Body: { related_to_type, related_to_id }
// Called when Lead marked Lost or Opportunity marked Won/Lost
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { related_to_type, related_to_id } = body;

    if (!related_to_type || !related_to_id) {
      return NextResponse.json(
        { success: false, message: "related_to_type and related_to_id are required" },
        { status: 400 }
      );
    }

    // Build the where clause based on related_to_type
    const where: any = {
      deletedAt: null,
      status: { in: ["Pending", "Overdue"] },
    };

    if (related_to_type === "Lead") {
      where.leadId = related_to_id;
    } else if (related_to_type === "Account" || related_to_type === "Customer") {
      where.customerId = related_to_id;
    } else if (related_to_type === "Opportunity" || related_to_type === "Deal") {
      // Look up the deal's customerId and cancel follow-ups for that customer
      const deal = await prisma.deal.findUnique({
        where: { id: related_to_id },
        select: { customerId: true },
      });
      if (!deal) {
        return NextResponse.json(
          { success: false, message: "Opportunity/Deal not found" },
          { status: 404 }
        );
      }
      where.customerId = deal.customerId;
    } else {
      return NextResponse.json(
        { success: false, message: "Bulk cancel only supports Lead, Account/Customer, and Opportunity/Deal types" },
        { status: 400 }
      );
    }

    const result = await prisma.followUp.updateMany({
      where,
      data: {
        status: "Cancelled",
        notes: `Bulk cancelled: ${related_to_type} closed`,
      },
    });

    await logAudit(user.id, "follow-up", "bulk_cancel", `Bulk cancelled ${result.count} open follow-ups for ${related_to_type}:${related_to_id}`, {
      resourceId: related_to_id,
      severity: "WARN",
    });

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");

    return NextResponse.json({
      success: true,
      message: `${result.count} follow-up(s) cancelled`,
      count: result.count,
    });
  } catch (error: any) {
    console.error("POST /api/follow-ups/bulk-cancel error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
