import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { dispatchNotification } from "@/lib/notifications";

// GET /api/tasks/:id/comments
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const task = await prisma.task.findUnique({ where: { id, deletedAt: null } });
    if (!task) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: comments });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/tasks/:id/comments
export async function POST(
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

    if (!body.comment_text?.trim()) {
      return NextResponse.json(
        { success: false, message: "Comment text is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({ where: { id, deletedAt: null } });
    if (!task) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        userId: user.id,
        commentText: body.comment_text.trim(),
      },
      include: { user: { select: { id: true, name: true } } },
    });

    // If commenter_id != task.assigned_to: notify assigned_to
    if (task.assignedTo !== user.id) {
      await dispatchNotification({
        userId: task.assignedTo,
        title: "New Task Comment",
        message: `New comment on task: ${task.title}`,
        type: "task",
        link: "/tasks",
      });
    }

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tasks/[id]/comments error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
