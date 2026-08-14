import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { createLeadWithWorkflow, checkLeadDuplicate, LeadDuplicateError } from "@/lib/leadWorkflow";
import { extractAuditContext } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, company, email, phone, city, state, leadSource, materialInterest, quantity, expectedPrice, notes } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
    }

    const normalizedEmail = email?.trim() || null;
    const normalizedPhone = phone?.trim() || null;
    const source = leadSource?.trim() || "Website";

    const duplicate = await checkLeadDuplicate(normalizedEmail, normalizedPhone);
    if (duplicate) {
      if (normalizedEmail && duplicate.email === normalizedEmail) {
        return NextResponse.json({ success: false, message: "Email already registered" }, { status: 400 });
      }
      return NextResponse.json({ success: false, message: "Phone already registered" }, { status: 400 });
    }

    const auditCtx = extractAuditContext(request);

    const { lead, assignedUser, slaDeadline } = await createLeadWithWorkflow({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      city: city?.trim() || null,
      leadSource: source,
      notes: [company, state, materialInterest, quantity, expectedPrice, notes].filter(Boolean).join(" | ") || null,
      companyId: user.companyId ?? null,
      createdById: user.id,
      auditContext: auditCtx,
    });

    // Save structured fields that are not handled by the workflow
    if (company || expectedPrice) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          companyName: company?.trim() || lead.companyName,
          estimatedValue: expectedPrice ? parseFloat(expectedPrice) : lead.estimatedValue,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: lead.id,
        leadCode: lead.leadCode,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        leadSource: lead.leadSource,
        status: lead.status,
        slaDeadline: slaDeadline.toISOString(),
        assignedTo: assignedUser ? { id: assignedUser.id, name: assignedUser.name } : null,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadDuplicateError) {
      return NextResponse.json({ success: false, message: "Lead already exists" }, { status: 400 });
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/leads/capture error:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
