import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceServiceEntitlement } from "@/lib/serviceEntitlement";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;

    const { id } = await params;
    const visit = await prisma.serviceVisit.findUnique({
      where: { id },
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        customer: { select: { id: true, name: true } },
        customerAsset: { select: { id: true, productName: true, serialNumber: true, amcExpiryDate: true } },
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
        partsUsed: true,
        photos: true,
      },
    });

    if (!visit || visit.deletedAt) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    return NextResponse.json(visit);
  } catch (error: any) {
    console.error("Error fetching visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;

    const { id } = await params;
    const body = await request.json();
    
    // Check if the record exists
    const existing = await prisma.serviceVisit.findUnique({ 
      where: { id },
      include: { status: true }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (body.statusId !== undefined) updateData.statusId = body.statusId;
    if (body.engineerId !== undefined) updateData.engineerId = body.engineerId;
    if (body.scheduledDate !== undefined) updateData.scheduledDate = body.scheduledDate ? (typeof body.scheduledDate === 'string' && body.scheduledDate.length === 10 ? new Date(`${body.scheduledDate}T12:00:00Z`) : new Date(body.scheduledDate)) : null;
    if (body.checkInTime !== undefined) updateData.checkInTime = body.checkInTime ? new Date(body.checkInTime) : null;
    if (body.checkOutTime !== undefined) updateData.checkOutTime = body.checkOutTime ? new Date(body.checkOutTime) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.customerId !== undefined) updateData.customerId = body.customerId || null;
    if (body.customerAssetId !== undefined) updateData.customerAssetId = body.customerAssetId || null;
    if (body.outcomeNotes !== undefined) updateData.outcomeNotes = body.outcomeNotes;
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;

    // State Transition Enforcement (C1)
    if (updateData.statusId && updateData.statusId !== existing.statusId) {
      const newStatus = await prisma.serviceStatus.findUnique({ where: { id: updateData.statusId } });
      if (!newStatus) return NextResponse.json({ error: "Invalid status ID" }, { status: 400 });
      
      const allowedTransitions = serviceModulesConfig.visits.allowedTransitions[existing.status.name] || [];
      if (!allowedTransitions.includes(newStatus.name)) {
        return NextResponse.json({ error: `Invalid status transition from ${existing.status.name} to ${newStatus.name}` }, { status: 400 });
      }
    }

    const updated = await prisma.serviceVisit.update({
      where: { id },
      data: updateData,
      include: {
        engineer: { include: { user: true } },
        status: true,
        createdBy: true,
        customer: { select: { id: true, name: true } },
        customerAsset: { select: { id: true, productName: true, serialNumber: true, amcExpiryDate: true } },
        request: { include: { customer: true, customerAsset: true } },
        complaint: { include: { customer: true, customerAsset: true } },
        defect: { include: { customer: true, customerAsset: true } },
        installation: { include: { customer: true, customerAsset: true } },
        partsUsed: true,
        photos: true,
      }
    });

    // Auto-create ServiceReview if marked as Completed or Resolved
    if (updated.status?.name === "Completed" || updated.status?.name === "Resolved") {
      if (updated.engineerId && updated.customerId) {
        const existingReview = await prisma.serviceReview.findFirst({
          where: { serviceVisitId: updated.id }
        });
        
        if (!existingReview) {
          await prisma.serviceReview.create({
            data: {
              customerId: updated.customerId,
              engineerId: updated.engineerId,
              serviceVisitId: updated.id,
              status: "Pending"
            }
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    
    // Check roles (H3)
    if (!["Admin", "SuperAdmin"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Soft Delete Implementation (C3)
    await prisma.serviceVisit.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: user.id
      }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting visit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
