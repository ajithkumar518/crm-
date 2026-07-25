import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.MANAGER_DASHBOARD, "GET /api/whatsapp-templates");
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const module = searchParams.get("module");

  const where: any = { companyId: user.companyId };
  if (module) where.module = module;

  const templates = await prisma.whatsAppTemplate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ success: true, data: templates });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }
  const guard = enforceModuleGuard(user, MODULE_KEYS.MANAGER_DASHBOARD, "POST /api/whatsapp-templates");
  if (guard) return guard;

  const body = await request.json();
  if (!body.name) return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
  if (!body.message) return NextResponse.json({ success: false, message: "Message is required" }, { status: 400 });
  if (!body.module) return NextResponse.json({ success: false, message: "Module is required" }, { status: 400 });

  const template = await prisma.whatsAppTemplate.create({
    data: {
      name: body.name,
      message: body.message,
      module: body.module,
      isActive: body.isActive !== false,
      companyId: user.companyId,
    },
  });

  return NextResponse.json({ success: true, data: template });
}
