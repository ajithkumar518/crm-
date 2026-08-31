import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const proposal = await prisma.proposal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      deal: { select: { id: true, dealName: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { changedBy: { select: { id: true, name: true } } },
      },
    },
  });

  if (!proposal) return NextResponse.json({ success: false, message: "Proposal not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: proposal });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.proposal.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Proposal not found" }, { status: 404 });

  const updateData: any = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.value !== undefined) updateData.value = parseFloat(body.value);
  if (body.validUntil !== undefined) updateData.validUntil = new Date(body.validUntil);
  if (body.proposalPdfUrl !== undefined) updateData.proposalPdfUrl = body.proposalPdfUrl;
  if (body.status !== undefined) updateData.status = body.status;

  const proposal = await prisma.proposal.update({
    where: { id },
    data: updateData,
  });

  // Create version if key fields changed
  if (body.title || body.value !== undefined || body.validUntil || body.description !== undefined) {
    const latestVersion = await prisma.proposalVersion.findFirst({
      where: { proposalId: id },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersion = (latestVersion?.versionNumber || 0) + 1;

    await prisma.proposalVersion.create({
      data: {
        proposalId: id,
        versionNumber: nextVersion,
        title: body.title || existing.title,
        description: body.description !== undefined ? body.description : existing.description,
        value: body.value !== undefined ? parseFloat(body.value) : existing.value,
        validUntil: body.validUntil ? new Date(body.validUntil) : existing.validUntil,
        proposalPdfUrl: body.proposalPdfUrl !== undefined ? body.proposalPdfUrl : existing.proposalPdfUrl,
        status: body.status || existing.status,
        changedById: user.id,
      },
    });
  }

  await logAudit(user.id, "Proposal", "Update", `Updated proposal ${existing.proposalNumber}`, {
    resourceId: id,
    previousState: { title: existing.title, value: existing.value, status: existing.status },
    newState: updateData,
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, data: proposal });
}

export async function DELETE(
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

  await prisma.proposal.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit(user.id, "Proposal", "Delete", `Deleted proposal ${existing.proposalNumber}`, {
    resourceId: id,
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true });
}
