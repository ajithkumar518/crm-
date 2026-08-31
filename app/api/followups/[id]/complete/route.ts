import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// PUT /api/follow-ups/:id/complete
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

    // Require: outcome_notes.length >= 5
    const outcomeNotes = (body.outcome_notes || body.completionNotes || body.remarks || "").trim();
    if (outcomeNotes.length < 5) {
      return NextResponse.json(
        { success: false, message: "Outcome notes must be at least 5 characters" },
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

    if (existing.status === "Completed") {
      return NextResponse.json({ success: false, message: "Follow-up has already been completed" }, { status: 400 });
    }

    // Mark follow-up as completed
    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        status: "Completed",
        completedAt: new Date(),
        completedById: user.id,
        completionNotes: outcomeNotes,
        notes: outcomeNotes,
      },
    });

    // If body.schedule_next = true: create chained follow-up
    if (body.schedule_next === true && body.next_datetime) {
      const nextDate = new Date(body.next_datetime);
      if (nextDate > new Date()) {
        const newFollowUp = await prisma.followUp.create({
          data: {
            customerId: existing.customerId || null,
            leadId: existing.leadId || null,
            assignedUserId: existing.assignedUserId,
            nextMeetingDate: nextDate,
            dueDate: nextDate,
            type: body.next_type || existing.type || null,
            status: "Pending",
            priority: existing.priority,
            sourceType: "MANUAL",
            companyId: user.companyId ?? null,
          },
        });

        // Link current follow-up to the new one
        await prisma.followUp.update({
          where: { id },
          data: { nextFollowupId: newFollowUp.id },
        });

        await logAudit(user.id, "follow-up", "complete", `Follow-up ${id} completed. Chained next follow-up ${newFollowUp.id} scheduled for ${nextDate.toISOString()}`, {
          resourceId: id,
          severity: "INFO",
        });
      }
    } else {
      await logAudit(user.id, "follow-up", "complete", `Follow-up ${id} completed with outcome notes`, {
        resourceId: id,
        severity: "INFO",
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/follow-up");
    if (existing.customerId) {
      revalidatePath(`/customers/${existing.customerId}`);
      revalidatePath(`/customer-master/${existing.customerId}`);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT /api/followups/[id]/complete error:", error);
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

