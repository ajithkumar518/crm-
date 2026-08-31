import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { extractAuditContext } from "@/lib/audit";
import { checkLeadDuplicate, createLeadWithWorkflow, LeadDuplicateError } from "@/lib/leadWorkflow";

async function resolveDefaultCompanyId(): Promise<string | null> {
  const envId = process.env.INTERNAL_COMPANY_ID?.trim();
  if (envId) return envId;

  const first = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

export async function POST(request: Request) {
  try {
    // Fetch system configurations from database
    const configs = await prisma.systemConfig.findMany();
    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    // 1. API key validation
    const apiKeyHeader = request.headers.get("x-api-key");
    const configuredApiKey =
      configMap.get("leads_api_key") || process.env.LEADS_API_KEY;
    if (!configuredApiKey) {
      return NextResponse.json(
        { success: false, message: "API key not configured" },
        { status: 500 }
      );
    }
    if (apiKeyHeader !== configuredApiKey) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Invalid API Key" },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { name, email, phone, city, message, leadSource } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Validation error: 'name' is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email?.trim() || null;
    const normalizedPhone = phone?.trim() || null;
    const normalizedCity = city?.trim() || null;
    const source = leadSource?.trim() || "Website";

    // 3. Duplicate detection (preserves exact legacy messages)
    const duplicate = await checkLeadDuplicate(normalizedEmail, normalizedPhone);
    if (duplicate) {
      if (normalizedEmail && duplicate.email === normalizedEmail) {
        return NextResponse.json(
          { success: false, message: "Validation error: Email address is already registered" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, message: "Validation error: Phone number is already registered" },
        { status: 400 }
      );
    }

    // Extract request context for audit trail
    const auditCtx = extractAuditContext(request);
    const companyId = await resolveDefaultCompanyId();

    // 4. Invoke reusable Lead Creation Workflow
    const { lead, assignedUser, slaDeadline } = await createLeadWithWorkflow({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      city: normalizedCity,
      leadSource: source,
      notes: message || null,
      companyId,
      createdById: null,
      auditContext: auditCtx,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Lead created and assigned successfully",
        data: {
          id: lead.id,
          leadCode: lead.leadCode,
          name: lead.name,
          slaDeadline: slaDeadline.toISOString(),
          assignedTo: assignedUser
            ? { id: assignedUser.id, name: assignedUser.name }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof LeadDuplicateError) {
      return NextResponse.json(
        { success: false, message: "Validation error: Lead already exists" },
        { status: 400 }
      );
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in POST /api/leads:", errorMsg);
    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error",
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const source = url.searchParams.get("source") || "";
    const search = url.searchParams.get("search") || "";

    const where: any = { deletedAt: null };
    if (user.companyId) where.companyId = user.companyId;
    if (source) where.leadSource = source;
    if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, leadCode: true, name: true, email: true, phone: true, city: true, leadSource: true, status: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: leads });
  } catch (error: any) {
    console.error("GET /api/leads error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
