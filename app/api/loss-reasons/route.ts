import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.DEALS, "GET /api/loss-reasons");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get("isActive");

  const where: any = { companyId: user.companyId };
  if (isActive === "true") where.isActive = true;
  if (isActive === "false") where.isActive = false;

  let reasons = await prisma.lossReason.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { lostDealAnalyses: true } } },
  });

  // Seed predefined loss reasons for this company if none exist yet
  if (reasons.length === 0 && isActive !== "false" && user.companyId) {
    const defaults = [
      "Price too high",
      "Lost to competitor",
      "No budget / Project cancelled",
      "No decision / Stalled",
      "Product fit mismatch",
      "Customer went silent",
    ];
    await prisma.lossReason.createMany({
      data: defaults.map((name) => ({
        name,
        isActive: true,
        companyId: user.companyId,
      })),
    });
    reasons = await prisma.lossReason.findMany({
      where: { companyId: user.companyId, isActive: true },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { lostDealAnalyses: true } } },
    });
  }

  return NextResponse.json({ success: true, data: reasons });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }
  const guard = enforceModuleGuard(user, MODULE_KEYS.DEALS, "POST /api/loss-reasons");
  if (guard) return guard;

  const body = await request.json();
  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });

  const reason = await prisma.lossReason.create({
    data: {
      name: body.name,
      isActive: body.isActive !== false,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: reason });
}
