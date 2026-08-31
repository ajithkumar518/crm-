import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/accounts/[id]/opportunities
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const deals = await prisma.deal.findMany({
      where: { customerId: id },
      orderBy: { updatedAt: "desc" },
      include: {
        assignedUser: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: deals,
      count: deals.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
