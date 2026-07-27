import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceServiceEntitlement } from "@/lib/serviceEntitlement";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const customerId = searchParams.get("customerId");
  const dealId = searchParams.get("dealId");
  const projectId = searchParams.get("projectId");

  const where: any = {};
  if (status && status !== "All") {
    where.status = status;
  }
  if (customerId) {
    where.customerId = customerId;
  }
  if (dealId) {
    where.dealId = dealId;
  }
  if (projectId) {
    where.projectId = projectId;
  }
  if (search) {
    where.OR = [
      { serialNumber: { contains: search, mode: "insensitive" } },
      { productName: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const assets = await prisma.customerAsset.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      purchaseOrder: { select: { id: true, poCode: true, poNumber: true } },
      product: { select: { id: true, name: true, productCode: true } },
      deal: { select: { id: true, dealName: true, opportunityCode: true } },
      project: { select: { id: true, projectCode: true, name: true } },
      AMCContract: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: assets });
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;
    if (!user || !["Admin", "SuperAdmin", "ServiceManager"].includes(user.role)) {
      return NextResponse.json({ success: false, message: "Forbidden: Insufficient privileges to manually onboard customer assets." }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, productName, serialNumber, purchaseDate, warrantyExpiryDate, amcExpiryDate, status, productId, dealId, projectId } = body;

    if (!customerId || !productName || !serialNumber) {
      return NextResponse.json({ success: false, message: "customerId, productName, and serialNumber are required fields." }, { status: 400 });
    }

    const existing = await prisma.customerAsset.findUnique({ where: { serialNumber: serialNumber.trim() } });
    if (existing) {
      return NextResponse.json({ success: false, message: `An asset with serial number '${serialNumber.trim()}' already exists.` }, { status: 400 });
    }

    const newAsset = await prisma.customerAsset.create({
      data: {
        customerId,
        productName: productName.trim(),
        serialNumber: serialNumber.trim(),
        status: status || "Active",
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        warrantyExpiryDate: warrantyExpiryDate ? new Date(warrantyExpiryDate) : null,
        amcExpiryDate: amcExpiryDate ? new Date(amcExpiryDate) : null,
        productId: productId || null,
        dealId: dealId || null,
        projectId: projectId || null,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        purchaseOrder: { select: { id: true, poCode: true, poNumber: true } },
        product: { select: { id: true, name: true, productCode: true } },
        deal: { select: { id: true, dealName: true, opportunityCode: true } },
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });

    await logAudit(user.id, "CustomerAsset", "Create", `Manually onboarded customer asset ${newAsset.serialNumber} (${newAsset.productName}) for customer ${customerId}`);

    return NextResponse.json({ success: true, data: newAsset }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating asset:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
