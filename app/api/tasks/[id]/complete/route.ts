import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

// PUT /api/tasks/:id/complete
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

    const existing = await prisma.task.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    // Validate: current_user_id = task.assigned_to OR user.role IN ('Sales Manager','Admin')
    if (existing.assignedTo !== user.id && user.role !== "SalesManager" && user.role !== "Admin") {
      return NextResponse.json(
        { success: false, message: "Only the assignee or a Manager can complete this task" },
        { status: 403 }
      );
    }

    if (existing.status === "Completed") {
      return NextResponse.json({ success: false, message: "Task is already completed" }, { status: 400 });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: "Completed",
        completedAt: new Date(),
      },
    });

    // Notify assigned_by: 'Task completed: [title]'
    if (existing.assignedBy && existing.assignedBy !== user.id) {
      await dispatchNotification({
        userId: existing.assignedBy,
        title: "Task Completed",
        message: `Task completed: ${existing.title}`,
        type: "task",
        link: "/tasks",
      });
    }

    await logAudit(user.id, "tasks", "complete", `Task ${id} marked as Completed`, {
      resourceId: id,
      severity: "INFO",
    });

    revalidatePath("/tasks");
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT /api/tasks/[id]/complete error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
