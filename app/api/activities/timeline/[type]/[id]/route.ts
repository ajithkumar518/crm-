import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/activities/timeline/:type/:id
// Returns a unified timeline array for any related record
export async function GET(
  request: Request,
  context: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { type, id } = await context.params;
    const items: any[] = [];

    // Map type to the fields we need to filter on
    const isLead = type === "Lead";
    const isAccount = type === "Account" || type === "Customer";

    // 1. CommunicationLog activities (Call, Meeting, Email, WhatsApp, Note)
    const commWhere: any = { deletedAt: null };
    if (isLead) {
      commWhere.leadId = id;
    } else if (isAccount) {
      commWhere.customerId = id;
    } else {
      // For other types, we don't have direct FKs — return empty for comm logs
      commWhere.id = "__none__";
    }

    const logs = await prisma.communicationLog.findMany({
      where: commWhere,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        sentByUser: { select: { id: true, name: true } },
        attendees: {
          include: {
            contact: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 200,
    });

    for (const log of logs) {
      const iconMap: Record<string, string> = {
        Call: "📞",
        Email: "📧",
        WhatsApp: "💬",
        Meeting: "🤝",
        Note: "📝",
      };
      items.push({
        id: `log-${log.id}`,
        source: "activity",
        type: log.channel,
        icon: iconMap[log.channel] || "📝",
        performed_by: log.sentByUser?.name || "System",
        timestamp: log.sentAt,
        description: log.content?.substring(0, 100) || "",
        outcome: log.outcome || log.status,
        full: {
          content: log.content,
          outcome: log.outcome,
          status: log.status,
          direction: log.direction,
          duration: log.duration,
          location: log.location,
          mode: log.mode,
          agenda: log.agenda,
          meetingDate: log.meetingDate,
          attendees: log.attendees,
        },
      });
    }

    // 2. Follow-ups for this record
    const followUpWhere: any = { deletedAt: null };
    if (isLead) {
      followUpWhere.leadId = id;
    } else if (isAccount) {
      followUpWhere.customerId = id;
    } else {
      followUpWhere.id = "__none__";
    }

    const followUps = await prisma.followUp.findMany({
      where: followUpWhere,
      include: {
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { nextMeetingDate: "desc" },
      take: 100,
    });

    for (const f of followUps) {
      items.push({
        id: `followup-${f.id}`,
        source: "follow_up",
        type: "FollowUp",
        icon: "📅",
        performed_by: f.assignedUser?.name || "System",
        timestamp: f.completedAt || f.nextMeetingDate || f.createdAt,
        description: f.remarks?.substring(0, 100) || f.notes?.substring(0, 100) || "Follow-up scheduled",
        outcome: f.status,
        full: {
          status: f.status,
          remarks: f.remarks,
          completionNotes: f.completionNotes,
          nextMeetingDate: f.nextMeetingDate,
          completedAt: f.completedAt,
          priority: f.priority,
        },
      });
    }

    // 3. Tasks for this record (via dealId if Opportunity, or contactId if Contact)
    if (type === "Opportunity" || type === "Deal") {
      const tasks = await prisma.task.findMany({
        where: { dealId: id, deletedAt: null },
        include: { User: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      for (const t of tasks) {
        items.push({
          id: `task-${t.id}`,
          source: "task",
          type: "Task",
          icon: "✅",
          performed_by: t.User?.name || "System",
          timestamp: t.completedAt || t.updatedAt,
          description: t.title?.substring(0, 100) || "",
          outcome: t.status,
          full: {
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            completedAt: t.completedAt,
          },
        });
      }
    }

    // 4. Lead activity log (if type=Lead, union with lead_activity_log equivalent)
    if (isLead) {
      // LeadStatusHistory or LeadOwnerHistory can serve as the lead activity log
      const ownerHistory = await prisma.leadOwnerHistory.findMany({
        where: { leadId: id },
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
          changedByUser: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 50,
      });

      for (const o of ownerHistory) {
        items.push({
          id: `lead-activity-${o.id}`,
          source: "lead_activity_log",
          type: "Reassignment",
          icon: "🔄",
          performed_by: o.changedByUser?.name || "System",
          timestamp: o.timestamp,
          description: `Lead reassigned from ${o.fromUser?.name || "Unassigned"} to ${o.toUser?.name || "Unassigned"}`,
          outcome: null,
          full: { fromUserId: o.fromUserId, toUserId: o.toUserId },
        });
      }
    }

    // Sort all items by timestamp desc
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    console.error("GET /api/activities/timeline error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
