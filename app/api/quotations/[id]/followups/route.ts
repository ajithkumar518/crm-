import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, status: true },
  });
  if (!quotation) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  const [followUps, statusHistory] = await Promise.all([
    prisma.followUp.findMany({
      where: { sourceType: "Quotation", sourceId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { assignedUser: { select: { id: true, name: true } } },
    }),
    prisma.quotationStatusHistory.findMany({
      where: { quotationId: id },
      orderBy: { changedAt: "desc" },
      include: { changedBy: { select: { id: true, name: true } } },
    }),
  ]);

  return NextResponse.json({ success: true, data: { followUps, statusHistory, quotation } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, status: true, customerId: true, assignedUserId: true },
  });
  if (!quotation) return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });

  const { nextMeetingDate, remarks, notes, newStatus } = body;

  const followUp = await prisma.$transaction(async (tx) => {
    const fu = await tx.followUp.create({
      data: {
        sourceType: "Quotation",
        sourceId: id,
        customerId: quotation.customerId,
        assignedUserId: quotation.assignedUserId || user.id,
        companyId: user.companyId,
        nextMeetingDate: nextMeetingDate ? new Date(nextMeetingDate) : new Date(),
        remarks,
        notes,
        status: "Pending",
      },
    });

    if (newStatus && newStatus !== quotation.status) {
      await tx.quotation.update({
        where: { id },
        data: { status: newStatus },
      });
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: id,
          fromStatus: quotation.status,
          toStatus: newStatus,
          changedById: user.id,
          notes: `Follow-up: ${remarks || notes || newStatus}`,
        },
      });
    }

    return fu;
  });

  return NextResponse.json({ success: true, data: followUp }, { status: 201 });
}
