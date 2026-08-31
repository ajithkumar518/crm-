import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await prisma.proposal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Proposal not found" }, { status: 404 });

  if (!["Sent", "CustomerReviewing", "RevisionRequested"].includes(existing.status)) {
    return NextResponse.json({ success: false, message: "Only Sent, CustomerReviewing, or RevisionRequested proposals can be rejected" }, { status: 400 });
  }

  const proposal = await prisma.proposal.update({
    where: { id },
    data: { status: "Rejected" },
  });

  await logAudit(user.id, "Proposal", "Reject", `Rejected proposal ${existing.proposalNumber}${body.reason ? `: ${body.reason}` : ""}`, {
    resourceId: id,
    previousState: { status: existing.status },
    newState: { status: "Rejected" },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, data: proposal });
}
