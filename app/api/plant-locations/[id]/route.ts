import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/plant-locations/[id]
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

    const location = await prisma.plantLocation.findUnique({ where: { id } });
    if (!location) {
      return NextResponse.json({ success: false, message: "Plant location not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: location });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT /api/plant-locations/[id]
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.plantLocation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Plant location not found" }, { status: 404 });
    }

    // If setting as primary, unset existing primary for this customer
    if (body.isPrimary === true && !existing.isPrimary) {
      await prisma.plantLocation.updateMany({
        where: { customerId: existing.customerId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.plantLocation.update({
      where: { id },
      data: {
        ...(body.locationName !== undefined && { locationName: body.locationName }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.state !== undefined && { state: body.state }),
        ...(body.pincode !== undefined && { pincode: body.pincode }),
        ...(body.gpsLat !== undefined && { gpsLat: body.gpsLat }),
        ...(body.gpsLng !== undefined && { gpsLng: body.gpsLng }),
        ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary }),
        ...(body.contactName !== undefined && { contactName: body.contactName }),
        ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/plant-locations/[id]
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await prisma.plantLocation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Plant location not found" }, { status: 404 });
    }

    await prisma.plantLocation.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Plant location deleted" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
