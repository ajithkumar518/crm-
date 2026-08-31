import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { nanoid } from "nanoid";

const VALID_RELATED_TYPES = ["Lead", "Account", "Contact", "Opportunity", "RFQ", "Quotation"];

const RELATED_TABLE_MAP: Record<string, string> = {
  Lead: "lead",
  Account: "customer",
  Contact: "contact",
  Opportunity: "opportunity",
  RFQ: "rFQ",
  Quotation: "quotation",
};

async function validateRelatedRecord(relatedToType: string, relatedToId: string): Promise<boolean> {
  const tableName = RELATED_TABLE_MAP[relatedToType];
  if (!tableName) return false;
  try {
    const record = await (prisma as any)[tableName].findUnique({ where: { id: relatedToId } });
    return !!record;
  } catch {
    return false;
  }
}

// GET /api/activities
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const channel = url.searchParams.get("channel") || "";
    const leadId = url.searchParams.get("leadId") || "";
    const customerId = url.searchParams.get("customerId") || "";
    const search = url.searchParams.get("search") || "";

    const where: any = { deletedAt: null };
    if (channel) where.channel = channel;
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { content: { contains: search } },
        { outcome: { contains: search } },
        { agenda: { contains: search } },
      ];
    }

    const logs = await prisma.communicationLog.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        lead: { select: { id: true, name: true, leadCode: true } },
        sentByUser: { select: { id: true, name: true } },
        attendees: { include: { contact: { select: { id: true, name: true } }, user: { select: { id: true, name: true } } } },
      },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    console.error("GET /api/activities error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/activities
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate related_to_type
    const relatedToType = body.related_to_type || body.relatedToType;
    const relatedToId = body.related_to_id || body.relatedToId;

    if (relatedToType) {
      if (!VALID_RELATED_TYPES.includes(relatedToType)) {
        return NextResponse.json(
          { success: false, message: `Invalid related_to_type. Must be one of: ${VALID_RELATED_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      if (!relatedToId) {
        return NextResponse.json(
          { success: false, message: "related_to_id is required when related_to_type is provided" },
          { status: 400 }
        );
      }
      const exists = await validateRelatedRecord(relatedToType, relatedToId);
      if (!exists) {
        return NextResponse.json(
          { success: false, message: `Related ${relatedToType} record not found` },
          { status: 400 }
        );
      }
    }

    const channel = body.channel || body.activity_type || "Note";

    // Map related_to to customerId/leadId for backward compat
    const customerId = body.customerId ?? (relatedToType === "Account" ? relatedToId : null);
    const leadId = body.leadId ?? (relatedToType === "Lead" ? relatedToId : null);

    if (channel === "Call") {
      const log = await prisma.communicationLog.create({
        data: {
          id: nanoid(),
          channel: "Call",
          customerId: customerId ?? null,
          leadId: leadId ?? null,
          direction: body.direction ?? "Outbound",
          duration: body.duration ?? body.duration_minutes ?? null,
          content: body.content ?? body.subject ?? "",
          status: body.status ?? body.outcome ?? "Completed",
          sentByUserId: user.id,
          sentAt: body.performed_at ? new Date(body.performed_at) : new Date(),
          companyId: user.companyId ?? null,
        },
      });

      await logAudit(user.id, "activities", "create", `Call activity logged for ${relatedToType || "general"}: ${log.id}`, {
        resourceId: log.id,
        severity: "INFO",
      });

      return NextResponse.json({ success: true, data: log }, { status: 201 });
    }

    if (channel === "Email") {
      const log = await prisma.communicationLog.create({
        data: {
          id: nanoid(),
          channel: "Email",
          customerId: customerId ?? null,
          leadId: leadId ?? null,
          direction: body.direction ?? "Outbound",
          content: body.content ?? body.body_preview ?? "",
          status: body.status ?? "Sent",
          agenda: body.email_subject ?? null,
          sentByUserId: user.id,
          sentAt: body.performed_at ? new Date(body.performed_at) : new Date(),
          companyId: user.companyId ?? null,
        },
      });

      await logAudit(user.id, "activities", "create", `Email activity logged: ${log.id}`, {
        resourceId: log.id,
        severity: "INFO",
      });

      return NextResponse.json({ success: true, data: log }, { status: 201 });
    }

    if (channel === "WhatsApp") {
      const log = await prisma.communicationLog.create({
        data: {
          id: nanoid(),
          channel: "WhatsApp",
          customerId: customerId ?? null,
          leadId: leadId ?? null,
          direction: body.direction ?? "Outbound",
          content: body.content ?? "",
          status: body.status ?? "Delivered",
          sentByUserId: user.id,
          sentAt: body.performed_at ? new Date(body.performed_at) : new Date(),
          companyId: user.companyId ?? null,
        },
      });

      await logAudit(user.id, "activities", "create", `WhatsApp activity logged: ${log.id}`, {
        resourceId: log.id,
        severity: "INFO",
      });

      return NextResponse.json({ success: true, data: log }, { status: 201 });
    }

    if (channel === "Meeting") {
      const log = await prisma.communicationLog.create({
        data: {
          id: nanoid(),
          channel: "Meeting",
          customerId: customerId ?? null,
          leadId: leadId ?? null,
          direction: "Outbound",
          meetingDate: body.meetingDate || body.performed_at ? new Date(body.meetingDate || body.performed_at) : null,
          location: body.location ?? null,
          mode: body.mode ?? null,
          agenda: body.agenda ?? body.subject ?? null,
          outcome: body.outcome ?? null,
          content: body.content ?? "",
          status: body.meeting_status ?? body.status ?? "Scheduled",
          sentByUserId: user.id,
          sentAt: body.performed_at ? new Date(body.performed_at) : new Date(),
          companyId: user.companyId ?? null,
          attendees: {
            create: [
              ...(body.contact_ids || []).map((cid: string) => ({ contactId: cid })),
              ...(body.user_ids || []).map((uid: string) => ({ userId: uid })),
            ],
          },
        },
        include: {
          attendees: { include: { contact: { select: { id: true, name: true } }, user: { select: { id: true, name: true } } } },
        },
      });

      await logAudit(user.id, "activities", "create", `Meeting activity logged with ${(body.contact_ids || []).length + (body.user_ids || []).length} attendees: ${log.id}`, {
        resourceId: log.id,
        severity: "INFO",
      });

      return NextResponse.json({ success: true, data: log }, { status: 201 });
    }

    if (channel === "Note") {
      const note = await prisma.note.create({
        data: {
          id: nanoid(),
          content: body.content ?? "",
          entityType: body.entityType ?? (relatedToType ? relatedToType.toUpperCase() : "LEAD"),
          entityId: body.entityId ?? relatedToId ?? "",
          createdById: user.id,
          companyId: user.companyId ?? null,
        },
      });

      await logAudit(user.id, "activities", "create", `Note activity logged: ${note.id}`, {
        resourceId: note.id,
        severity: "INFO",
      });

      return NextResponse.json({ success: true, data: note }, { status: 201 });
    }

    return NextResponse.json({ success: false, message: "Invalid channel" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/activities error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
