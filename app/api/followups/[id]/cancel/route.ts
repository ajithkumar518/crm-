import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// PUT /api/follow-ups/:id/cancel
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Require cancellation_reason non-empty
    const reason = body.cancellation_reason?.trim() || body.reason?.trim() || body.notes?.trim();
    if (!reason) {
      return NextResponse.json(
        { success: false, message: "Cancellation reason is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.followUp.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Follow-up not found" }, { status: 404 });
    }

    // Authorization: assignee or Manager/Admin
    if (existing.assignedUserId !== user.id && user.role !== "SalesManager" && user.role !== "Admin") {
      return NextResponse.json(
        { success: false, message: "Unauthorized: You do not own this follow-up" },
        { status: 403 }
      );
    }

    if (existing.status === "Completed" || existing.status === "Cancelled") {
      return NextResponse.json({ success: false, message: `Follow-up is already ${existing.status}` }, { status: 400 });
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        status: "Cancelled",
        notes: reason,
        remarks: reason,
      },
    });

    await logAudit(user.id, "follow-up", "cancel", `Follow-up ${id} cancelled: ${reason}`, {
      resourceId: id,
      severity: "WARN",
    });

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    if (existing.customerId) {
      revalidatePath(`/customers/${existing.customerId}`);
      revalidatePath(`/customer-master/${existing.customerId}`);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT /api/followups/[id]/cancel error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PATCH alias for backward compat
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

