import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit, extractAuditContext } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";

  const where: any = { deletedAt: null, companyId: user.companyId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { proposalNumber: { contains: search } },
      { customer: { name: { contains: search } } },
    ];
  }

  const proposals = await prisma.proposal.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      deal: { select: { id: true, dealName: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: proposals });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { customerId, dealId, title, description, value, validUntil, proposalPdfUrl } = body;

  if (!customerId || !title || !validUntil) {
    return NextResponse.json({ success: false, message: "Missing required fields: customerId, title, validUntil" }, { status: 400 });
  }

  const count = await prisma.proposal.count({ where: { companyId: user.companyId } });
  const proposalNumber = `PROP-${String(count + 1).padStart(5, "0")}`;

  const proposal = await prisma.proposal.create({
    data: {
      proposalNumber,
      customerId,
      dealId: dealId || null,
      title,
      description: description || null,
      value: parseFloat(value) || 0,
      validUntil: new Date(validUntil),
      proposalPdfUrl: proposalPdfUrl || null,
      status: "Draft",
      companyId: user.companyId,
    },
  });

  await prisma.proposalVersion.create({
    data: {
      proposalId: proposal.id,
      versionNumber: 1,
      title,
      description: description || null,
      value: parseFloat(value) || 0,
      validUntil: new Date(validUntil),
      proposalPdfUrl: proposalPdfUrl || null,
      status: "Draft",
      changedById: user.id,
    },
  });

  await logAudit(user.id, "Proposal", "Create", `Created proposal ${proposalNumber}`, {
    resourceId: proposal.id,
    newState: { title, value, status: "Draft" },
    context: extractAuditContext(request),
  });

  return NextResponse.json({ success: true, data: proposal });
}
