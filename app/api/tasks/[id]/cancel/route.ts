import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// PUT /api/tasks/:id/cancel
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

    // Require cancellation_reason non-empty string (400 if blank)
    const reason = body.cancellation_reason?.trim() || body.cancellationReason?.trim();
    if (!reason) {
      return NextResponse.json(
        { success: false, message: "Cancellation reason is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.task.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    // Authorization: assignee or Manager/Admin
    if (existing.assignedTo !== user.id && user.role !== "SalesManager" && user.role !== "Admin") {
      return NextResponse.json(
        { success: false, message: "Only the assignee or a Manager can cancel this task" },
        { status: 403 }
      );
    }

    if (existing.status === "Completed" || existing.status === "Cancelled") {
      return NextResponse.json({ success: false, message: `Task is already ${existing.status}` }, { status: 400 });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: "Cancelled",
        cancellationReason: reason,
      },
    });

    await logAudit(user.id, "tasks", "cancel", `Task ${id} cancelled: ${reason}`, {
      resourceId: id,
      severity: "WARN",
    });

    revalidatePath("/tasks");
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT /api/tasks/[id]/cancel error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
