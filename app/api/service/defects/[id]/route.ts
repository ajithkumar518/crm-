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
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const defect = await prisma.defect.findUnique({
      where: { id },
      include: {
        customer: true,
        customerAsset: { include: { AMCContract: { orderBy: { createdAt: "desc" }, take: 1 } } },
        priority: true,
        status: true,
        category: true,
        defectType: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        createdBy: true,
        visits: {
          include: {
            engineer: { include: { user: true } },
            status: true
          }
        },
      },
    });

    if (!defect || defect.deletedAt) {
      return NextResponse.json({ error: "Defect not found" }, { status: 404 });
    }

    return NextResponse.json(defect);
  } catch (error: any) {
    console.error("Error fetching defect:", error);
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
    const existing = await prisma.defect.findUnique({ 
      where: { id },
      include: { status: true }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Defect not found" }, { status: 404 });
    }

    // Whitelist allowed fields
    const allowedFields: Record<string, any> = {};
    const permitted = ["title", "description", "categoryId", "defectTypeId", "priorityId", "statusId", "customerId", "customerAssetId", "assignedTeamId", "assignedEngineerId", "closedAt"];
    for (const key of permitted) {
      if (body[key] !== undefined) allowedFields[key] = body[key];
    }

    // State Transition Enforcement (C1)
    if (allowedFields.statusId && allowedFields.statusId !== existing.statusId) {
      const newStatus = await prisma.serviceStatus.findUnique({ where: { id: allowedFields.statusId } });
      if (!newStatus) return NextResponse.json({ error: "Invalid status ID" }, { status: 400 });
      
      const allowedTransitions = serviceModulesConfig.defects.allowedTransitions[existing.status.name] || [];
      if (!allowedTransitions.includes(newStatus.name)) {
        return NextResponse.json({ error: `Invalid status transition from ${existing.status.name} to ${newStatus.name}` }, { status: 400 });
      }
    }

    const updated = await prisma.defect.update({
      where: { id },
      data: allowedFields,
      include: {
        customer: true,
        customerAsset: { include: { AMCContract: { orderBy: { createdAt: "desc" }, take: 1 } } },
        priority: true,
        status: true,
        category: true,
        defectType: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        createdBy: true,
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating defect:", error);
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
    
    // Soft Delete Implementation (C3)
    await prisma.defect.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: user.id
      }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting defect:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
