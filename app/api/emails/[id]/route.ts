import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (status !== "Enquiry" && status !== "General") {
    return NextResponse.json({ success: false, message: "Invalid classification" }, { status: 400 });
  }

  // Try CommunicationLog first (manual entries)
  const commLog = await prisma.communicationLog.findFirst({
    where: { id, companyId: user.companyId ?? null },
  });
  if (commLog) {
    const updated = await prisma.communicationLog.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  // Try InboundEmailLog (poller entries)
  const inboundLog = await prisma.inboundEmailLog.findUnique({ where: { id } });
  if (inboundLog) {
    const updated = await prisma.inboundEmailLog.update({
      where: { id },
      data: {
        classification: status,
        manuallyOverridden: true,
        classificationReason: `Manually reclassified from ${inboundLog.classification || "Unclassified"} to ${status} by user ${user.id}`,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  return NextResponse.json({ success: false, message: "Email not found" }, { status: 404 });
}
