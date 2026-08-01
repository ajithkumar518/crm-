import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractAuditContext } from "@/lib/audit";
import { createLeadWithWorkflow } from "@/lib/leadWorkflow";

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

    // 3. Duplicate detection
    if (normalizedEmail) {
      const existingEmail = await prisma.lead.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "Validation error: Email address is already registered",
          },
          { status: 400 }
        );
      }
    }

    if (normalizedPhone) {
      const existingPhone = await prisma.lead.findFirst({
        where: { phone: normalizedPhone },
      });
      if (existingPhone) {
        return NextResponse.json(
          {
            success: false,
            message: "Validation error: Phone number is already registered",
          },
          { status: 400 }
        );
      }
    }

    // Extract request context for audit trail
    const auditCtx = extractAuditContext(request);

    // 4. Invoke reusable Lead Creation Workflow
    const { lead, assignedUser, slaDeadline } = await createLeadWithWorkflow({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      city: normalizedCity,
      leadSource: source,
      notes: message || null,
      auditContext: auditCtx,
    });

    // Optional call log for message
    if (message && assignedUser) {
      await prisma.callLog.create({
        data: {
          leadId: lead.id,
          notes: `Inbound website enquiry message: "${message.trim()}"`,
          duration: 0,
          userId: assignedUser.id,
        },
      }).catch((e) => console.error("CallLog creation error", e));
    }

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
