import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { classifyEmail } from "@/lib/email-classification";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const classification = searchParams.get("classification") || "";

  // Fetch CommunicationLog emails (manual entries) + InboundEmailLog (poller entries)
  const where: any = { channel: "Email", direction: "Inbound", deletedAt: null };
  if (user.companyId) where.companyId = user.companyId;
  if (classification) where.status = classification;

  const [emails, inboundEmails] = await Promise.all([
    prisma.communicationLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: 100,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    }),
    prisma.inboundEmailLog.findMany({
      where: classification
        ? { classification, ...(user.companyId ? {} : {}) }
        : {},
      orderBy: { receivedAt: "desc" },
      take: 100,
      include: {
        lead: { select: { id: true, leadCode: true, name: true } },
      },
    }),
  ]);

  // Normalize inbound emails to match CommunicationLog shape for the UI
  const normalizedInbound = inboundEmails.map((e) => ({
    id: e.id,
    channel: "Email",
    direction: "Inbound",
    status: e.classification || "Unclassified",
    content: `[From: ${e.fromEmail}]\nSubject: ${e.subject || ""}\n\n${e.bodyText || ""}`,
    sentAt: e.receivedAt,
    customerId: null,
    customer: null,
    leadId: e.leadId,
    lead: e.lead,
    classificationReason: e.classificationReason,
    classificationConfidence: e.classificationConfidence,
    manuallyOverridden: e.manuallyOverridden,
    source: "inbound_poller",
  }));

  return NextResponse.json({ success: true, data: [...emails, ...normalizedInbound] });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { from, subject, body: emailBody, classification, customerId } = body;

  if (!emailBody || !subject) {
    return NextResponse.json({ success: false, message: "Subject and body are required" }, { status: 400 });
  }

  // Auto-classify if no manual classification provided
  let finalClassification = classification;
  let classificationReason: string | null = null;
  let classificationConfidence: number | null = null;

  if (!finalClassification || (finalClassification !== "Enquiry" && finalClassification !== "General")) {
    const result = classifyEmail(subject, emailBody);
    finalClassification = result.classification;
    classificationReason = result.reason;
    classificationConfidence = result.confidence;
  }

  const email = await prisma.communicationLog.create({
    data: {
      channel: "Email",
      direction: "Inbound",
      status: finalClassification,
      content: `[From: ${from || "Unknown"}]\nSubject: ${subject}\n\n${emailBody}`,
      customerId: customerId || null,
      sentByUserId: user.id,
      companyId: user.companyId ?? null,
    },
  });

  if (finalClassification === "Enquiry" && body.name && body.phone) {
    // Optionally create a lead from this email if name + phone provided
    const { checkLeadDuplicate, createLeadWithWorkflow } = await import("@/lib/leadWorkflow");
    const duplicate = await checkLeadDuplicate(body.email || null, body.phone);
    if (!duplicate) {
      try {
        await createLeadWithWorkflow({
          name: body.name,
          email: body.email?.trim() || null,
          phone: body.phone,
          city: body.city?.trim() || null,
          leadSource: "Email",
          notes: `Enquiry from email: ${subject}\n${emailBody.slice(0, 500)}`,
          companyId: user.companyId ?? null,
          createdById: user.id,
        });
      } catch {
        // ignore duplicate race
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: email,
    classification: finalClassification,
    classificationReason,
    classificationConfidence,
  }, { status: 201 });
}
