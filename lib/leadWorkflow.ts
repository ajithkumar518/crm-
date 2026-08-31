/**
 * leadWorkflow.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Reusable lead creation + duplicate detection workflow used by API and
 * server-side entry points. Keeps lead lifecycle rules (code generation,
 * SLA, territory routing, status history, audit) in one place.
 */

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { AuditContext } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications";

export class LeadDuplicateError extends Error {
  constructor(
    message: string,
    public readonly email?: string | null,
    public readonly phone?: string | null,
  ) {
    super(message);
    this.name = "LeadDuplicateError";
  }
}

export interface CreateLeadWithWorkflowInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  leadSource?: string | null;
  notes?: string | null;
  companyId?: string | null;
  createdById?: string | null;
  auditContext?: AuditContext | null;
  industryType?: string | null;
  estimatedValue?: number | null;
  companyName?: string | null;
  designation?: string | null;
}

export interface CreateLeadWithWorkflowResult {
  lead: any;
  assignedUser: { id: string; name: string } | null;
  slaDeadline: Date;
}

/**
 * Check for an existing non-deleted lead with the same email or phone.
 */
export async function checkLeadDuplicate(
  email: string | null,
  phone: string | null,
): Promise<{
  id: string;
  email?: string | null;
  phone?: string | null;
} | null> {
  const normalizedEmail = email?.trim() || null;
  const normalizedPhone = phone?.trim() || null;

  if (!normalizedEmail && !normalizedPhone) return null;

  const or: { email?: string; phone?: string }[] = [];
  if (normalizedEmail) or.push({ email: normalizedEmail });
  if (normalizedPhone) or.push({ phone: normalizedPhone });

  const duplicate = await prisma.lead.findFirst({
    where: {
      deletedAt: null,
      OR: or as any,
    },
    select: { id: true, email: true, phone: true },
  });

  return duplicate;
}

// ── V2: Lead Score Algorithm (0–100) ─────────────────────────────────────────
function calculateLeadScore(params: {
  industryType?: string | null;
  leadSource?: string | null;
  designation?: string | null;
  estimatedValue?: number | null;
  email?: string | null;
  phone?: string | null;
}): number {
  let score = 0;

  const industry = (params.industryType || "").toLowerCase();
  if (["automotive", "pharma", "textile"].includes(industry)) score += 25;
  else score += 10;

  const source = (params.leadSource || "").toLowerCase().replace(/\s/g, "");
  if (source === "referral") score += 20;
  else if (source === "tradeshow") score += 18;
  else if (source === "website") score += 15;
  else if (source === "coldcall") score += 10;
  else score += 5;

  const desig = (params.designation || "").toLowerCase();
  if (/(head|director|vp|gm|ceo|md|president)/.test(desig)) score += 20;
  else if (/manager/.test(desig)) score += 15;
  else score += 10;

  const val = params.estimatedValue;
  if (val != null && val > 0) {
    if (val > 1000000) score += 20;
    else if (val >= 100000) score += 15;
    else score += 10;
  }

  if (params.email && params.phone) score += 15;
  else if (params.email || params.phone) score += 7;

  return Math.min(score, 100);
}

// ── V2: Generate LD-YYYY-NNNNN code ──────────────────────────────────────────
async function generateLeadCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LD-${year}-`;

  const lastLead = await prisma.lead.findFirst({
    where: { leadCode: { startsWith: prefix } },
    orderBy: { leadCode: "desc" },
    select: { leadCode: true },
  });

  let nextSeq = 1;
  if (lastLead?.leadCode) {
    const lastSeq = parseInt(lastLead.leadCode.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}

// ── Resolve owner via territory match, then company default ──────────────────
async function resolveOwner(
  companyId: string | null | undefined,
  city: string | null | undefined,
): Promise<string | null> {
  const trimmedCity = city?.trim();

  if (companyId && trimmedCity) {
    const territory = await prisma.territory.findFirst({
      where: {
        companyId,
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: trimmedCity } },
          { states: { contains: trimmedCity } },
        ],
      },
      select: { assignedUserId: true },
    });

    if (territory?.assignedUserId) return territory.assignedUserId;
  }

  if (companyId) {
    const user = await prisma.user.findFirst({
      where: {
        companyId,
        isActive: true,
        deletedAt: null,
        role: { in: ["Admin", "SalesManager"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (user) return user.id;
  }

  return null;
}

function getNextBusinessDay9AM(from: Date): Date {
  const nextDay = new Date(from);
  nextDay.setDate(nextDay.getDate() + 1);
  while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  nextDay.setHours(9, 0, 0, 0);
  return nextDay;
}

/**
 * Create a lead with the standard V2 workflow:
 * code generation, SLA, scoring, territory/default assignment,
 * status history, owner history, initial follow-up, and audit logging.
 */
export async function createLeadWithWorkflow(
  input: CreateLeadWithWorkflowInput,
): Promise<CreateLeadWithWorkflowResult> {
  const {
    name,
    email,
    phone,
    city,
    leadSource,
    notes,
    companyId,
    createdById,
    auditContext,
    industryType,
    estimatedValue,
    companyName,
    designation,
  } = input;

  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new LeadDuplicateError("Validation error: 'name' is required");
  }

  const normalizedEmail = email?.trim() || null;
  const normalizedPhone = phone?.trim() || null;
  const normalizedCity = city?.trim() || null;
  const source = leadSource?.trim() || "Website";

  const duplicate = await checkLeadDuplicate(normalizedEmail, normalizedPhone);
  if (duplicate) {
    if (normalizedEmail && duplicate.email === normalizedEmail) {
      throw new LeadDuplicateError(
        "Validation error: Email address is already registered",
        normalizedEmail,
        null,
      );
    }
    throw new LeadDuplicateError(
      "Validation error: Phone number is already registered",
      null,
      normalizedPhone,
    );
  }

  const leadCode = await generateLeadCode();
  const leadScore = calculateLeadScore({
    leadSource: source,
    email: normalizedEmail,
    phone: normalizedPhone,
    industryType: input.industryType || null,
    estimatedValue: input.estimatedValue || null,
    designation: input.designation || null,
  });

  const assignedUserId = await resolveOwner(companyId, normalizedCity);

  const now = new Date();
  const slaDeadline = new Date(now.getTime() + 15 * 60 * 1000);

  const lead = await prisma.lead.create({
    data: {
      leadCode,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      city: normalizedCity,
      leadSource: source,
      notes: notes?.trim() || null,
      companyId: companyId || null,
      assignedUserId,
      status: "New",
      slaStatus: "Pending",
      slaResponseDeadline: slaDeadline,
      lastInteractionAt: now,
      escalationLevel: 0,
      leadScore,
      companyName: companyName || null,
      designation: designation || null,
      industryType: industryType || null,
      estimatedValue: estimatedValue || null,
    },
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      fromStatus: null,
      toStatus: "New",
      changedById: assignedUserId ?? createdById ?? null,
      notes: "Lead created via lead workflow",
    },
  });

  if (assignedUserId) {
    await prisma.leadOwnerHistory
      .create({
        data: {
          leadId: lead.id,
          fromUserId: null,
          toUserId: assignedUserId,
          changedById: createdById ?? null,
          reason: "Automatic assignment (territory / default owner)",
        },
      })
      .catch(() => {});

    await prisma.followUp
      .create({
        data: {
          leadId: lead.id,
          type: "Call",
          nextMeetingDate: getNextBusinessDay9AM(now),
          remarks: "Initial follow-up call for new lead",
          status: "Pending",
          priority: "Medium",
          assignedUserId,
          sourceType: "AUTO",
          companyId: companyId || null,
          stageAtCreation: "Lead",
        },
      })
      .catch(() => {});
  }

  const assignedUser = assignedUserId
    ? await prisma.user.findUnique({
        where: { id: assignedUserId },
        select: { id: true, name: true },
      })
    : null;

  if (assignedUser) {
    await dispatchNotification({
      userId: assignedUser.id,
      title: "New Lead Assigned",
      message: `New lead assigned: ${normalizedName} (${leadCode})`,
      type: "lead",
      link: `/leads/${lead.id}?action=contact`,
    }).catch(() => {});
  }

  await logAudit(
    createdById ?? assignedUserId ?? null,
    "LEADS",
    "CREATE_LEAD",
    `Created lead: ${normalizedName} (${leadCode}) — Score: ${leadScore}/100 — SLA: ${slaDeadline.toISOString()}`,
    {
      resourceId: lead.id,
      newState: lead,
      context: auditContext ?? null,
    },
  ).catch(() => {});

  return {
    lead,
    assignedUser: assignedUser
      ? { id: assignedUser.id, name: assignedUser.name }
      : null,
    slaDeadline,
  };
}
