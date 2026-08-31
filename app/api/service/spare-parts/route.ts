import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceServiceEntitlement } from "@/lib/serviceEntitlement";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const onlyActive = searchParams.get("active") === "true";
  const search = searchParams.get("search");

  const where: any = {};
  if (onlyActive) where.isActive = true;
  if (search) {
    where.OR = [
      { partCode: { contains: search, mode: "insensitive" } },
      { partName: { contains: search, mode: "insensitive" } },
    ];
  }

  const parts = await prisma.sparePart.findMany({
    where,
    orderBy: { partName: "asc" },
  });

  return NextResponse.json({ success: true, data: parts });
}
