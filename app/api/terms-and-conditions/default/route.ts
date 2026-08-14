import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const tnc = await prisma.termsAndConditions.findFirst({
    where: { companyId: user.companyId, isActive: true, isDefault: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, content: true },
  });

  if (tnc) {
    return NextResponse.json({ success: true, data: tnc });
  }

  const DEFAULT_SUKI_TNC = `Cutting Charges – Extra
Weighing/Loading Charges – Rs. 350/- per Ton
Delivery Charges – Extra
Testing Charges – Extra
Quotation Validity – Immediate
Taxes – Extra
Rejection Clause – Material will be accepted only in the supplied condition.
Weighment Tolerance – ±5 Kgs per MT.
Clerical errors are subject to correction.`;

  const created = await prisma.termsAndConditions.create({
    data: {
      name: "SUKI Default",
      content: DEFAULT_SUKI_TNC,
      isDefault: true,
      isActive: true,
      companyId: user.companyId,
    },
    select: { id: true, name: true, content: true },
  });

  return NextResponse.json({ success: true, data: created });
}
