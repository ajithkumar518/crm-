import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Find tasks that are becoming overdue (for notification)
    const becomingOverdue = await prisma.task.findMany({
      where: {
        deletedAt: null,
        status: "Open",
        dueDate: { lt: now },
      },
      select: { id: true, title: true, assignedTo: true, priority: true },
    });

    // Mark as overdue
    const result = await prisma.task.updateMany({
      where: {
        deletedAt: null,
        status: "Open",
        dueDate: { lt: now },
      },
      data: { status: "Overdue" },
    });

    // Notify assignees
    for (const task of becomingOverdue) {
      if (task.assignedTo) {
        await dispatchNotification({
          userId: task.assignedTo,
          title: "Task Overdue",
          message: `Task "${task.title}" is now overdue.`,
          type: "task",
          link: "/tasks",
        }).catch(() => {});
      }

      // Critical task escalation — notify managers
      if (task.priority === "Critical") {
        const managers = await prisma.user.findMany({
          where: { role: { in: ["Admin", "SalesManager"] }, isActive: true },
          select: { id: true },
        });
        for (const mgr of managers) {
          await dispatchNotification({
            userId: mgr.id,
            title: "Critical Task Escalation",
            message: `Critical task "${task.title}" is overdue and requires immediate attention.`,
            type: "task",
            link: "/tasks",
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true, count: result.count, message: `${result.count} tasks marked as overdue` });
  } catch (error: any) {
    console.error("POST /api/cron/tasks-overdue error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
