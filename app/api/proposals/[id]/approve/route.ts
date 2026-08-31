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

  const existing = await prisma.proposal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Proposal not found" }, { status: 404 });

  if (!["Sent", "CustomerReviewing", "RevisionRequested"].includes(existing.status)) {
    return NextResponse.json({ success: false, message: "Only Sent, CustomerReviewing, or RevisionRequested proposals can be accepted" }, { status: 400 });
  }

  const proposal = await prisma.proposal.update({
    where: { id },
    data: { status: "Accepted" },
  });

  // If linked to a deal, optionally advance deal status
  if (existing.dealId) {
    await prisma.deal.update({
      where: { id: existing.dealId },
      data: { status: "ProposalSent" },
    }).catch(() => {});
  }

  await logAudit(user.id, "Proposal", "Accept", `Accepted proposal ${existing.proposalNumber}`, {
    resourceId: id,
    previousState: { status: existing.status },
    newState: { status: "Accepted" },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, data: proposal });
}
