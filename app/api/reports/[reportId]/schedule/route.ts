import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/reports/[reportId]/schedule — get schedule for a report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { reportId } = await params;
  const schedules = await prisma.reportSchedule.findMany({
    where: { reportId, companyId: user.companyId, isActive: true },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, schedules });
}

// POST /api/reports/[reportId]/schedule — create/update schedule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { reportId } = await params;
  const body = await request.json();
  const { frequency, format, recipientIds, filtersJson } = body;

  if (!frequency || !format || !recipientIds || !Array.isArray(recipientIds)) {
    return NextResponse.json({ success: false, message: "Missing required fields: frequency, format, recipientIds" }, { status: 400 });
  }

  const schedule = await prisma.reportSchedule.create({
    data: {
      reportId,
      frequency,
      format,
      recipientIds: JSON.stringify(recipientIds),
      filtersJson: filtersJson ? JSON.stringify(filtersJson) : null,
      createdById: user.id,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, schedule });
}
