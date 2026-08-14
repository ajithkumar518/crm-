import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const classification = searchParams.get("classification") || "";

  const where: any = { channel: "Email", direction: "Inbound", deletedAt: null };
  if (user.companyId) where.companyId = user.companyId;
  if (classification) where.status = classification;

  const emails = await prisma.communicationLog.findMany({
    where,
    orderBy: { sentAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
    },
  });

  return NextResponse.json({ success: true, data: emails });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { from, subject, body: emailBody, classification, customerId } = body;

  if (!emailBody || !subject) {
    return NextResponse.json({ success: false, message: "Subject and body are required" }, { status: 400 });
  }

  if (classification !== "Enquiry" && classification !== "General") {
    return NextResponse.json({ success: false, message: "Classification must be Enquiry or General" }, { status: 400 });
  }

  const email = await prisma.communicationLog.create({
    data: {
      channel: "Email",
      direction: "Inbound",
      status: classification,
      content: `[From: ${from || "Unknown"}]\nSubject: ${subject}\n\n${emailBody}`,
      customerId: customerId || null,
      sentByUserId: user.id,
      companyId: user.companyId ?? null,
    },
  });

  if (classification === "Enquiry" && body.name && body.phone) {
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

  return NextResponse.json({ success: true, data: email }, { status: 201 });
}
