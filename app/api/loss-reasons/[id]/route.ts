import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }
  const guard = enforceModuleGuard(user, MODULE_KEYS.DEALS, "PUT /api/loss-reasons/[id]");
  if (guard) return guard;

  const { id } = await params;
  const existing = await prisma.lossReason.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const body = await request.json();
  const updated = await prisma.lossReason.update({
    where: { id },
    data: {
      name: body.name,
      isActive: body.isActive,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }
  const guard = enforceModuleGuard(user, MODULE_KEYS.DEALS, "DELETE /api/loss-reasons/[id]");
  if (guard) return guard;

  const { id } = await params;
  const existing = await prisma.lossReason.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  await prisma.lossReason.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
