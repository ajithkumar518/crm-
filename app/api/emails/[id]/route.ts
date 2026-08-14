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

  const existing = await prisma.communicationLog.findFirst({
    where: { id, companyId: user.companyId ?? null },
  });
  if (!existing) return NextResponse.json({ success: false, message: "Email not found" }, { status: 404 });

  const updated = await prisma.communicationLog.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ success: true, data: updated });
}
