import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceServiceEntitlement } from "@/lib/serviceEntitlement";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const claim = await prisma.warrantyClaim.findUnique({
      where: { id },
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Warranty claim not found" }, { status: 404 });
    }

    return NextResponse.json(claim);
  } catch (error: any) {
    console.error("Error fetching warranty claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    const _svcGuard2 = await enforceServiceEntitlement(user);
    if (_svcGuard2) return _svcGuard2;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    
    // Check if the record exists
    const existing = await prisma.warrantyClaim.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Warranty claim not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (body.statusId !== undefined) updateData.statusId = body.statusId;
    if (body.resolution !== undefined) updateData.resolution = body.resolution;

    const updated = await prisma.warrantyClaim.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        customerAsset: true,
        status: true,
        createdBy: true,
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating warranty claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    const _svcGuard3 = await enforceServiceEntitlement(user);
    if (_svcGuard3) return _svcGuard3;
    if (!user || !["Admin", "SuperAdmin"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.warrantyClaim.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting warranty claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
