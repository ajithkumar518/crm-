import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: {
      companyId: user.companyId,
      isActive: true,
      userType: "internal",
    },
    select: { id: true, name: true, email: true, role: true, department: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, data: users });
}
