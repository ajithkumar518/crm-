import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

const ERP_CONFIG_KEYS = ["erp_enabled", "erp_endpoint", "erp_api_key", "erp_company_code", "erp_quotation_sync", "erp_sales_order_sync"];

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: ERP_CONFIG_KEYS } },
    select: { key: true, value: true },
  });

  const raw = Object.fromEntries(configs.map((c) => [c.key, c.value]));
  const data: any = { ...raw };
  data.erp_enabled = raw.erp_enabled === "true";
  data.erp_quotation_sync = raw.erp_quotation_sync === "true";
  data.erp_sales_order_sync = raw.erp_sales_order_sync === "true";

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates = [];

  for (const key of ERP_CONFIG_KEYS) {
    if (body[key] !== undefined) {
      const value = typeof body[key] === "boolean" ? String(body[key]) : String(body[key]);
      updates.push(prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }));
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, message: "No settings provided" }, { status: 400 });
  }

  await prisma.$transaction(updates);
  return NextResponse.json({ success: true, message: "ERP settings saved" });
}
