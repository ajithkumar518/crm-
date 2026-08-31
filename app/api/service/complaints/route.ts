import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeEscalations } from "@/lib/escalationService";
import { verifyAuth } from "@/lib/auth";
import { enforceServiceEntitlement } from "@/lib/serviceEntitlement";
import { checkAmcQuota } from "@/lib/amcQuota";

export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const statusId = searchParams.get("statusId");
    const projectId = searchParams.get("projectId");
    
    let whereClause: any = {};
    if (customerId) whereClause.customerId = customerId;
    if (statusId) whereClause.statusId = statusId;
    if (projectId) whereClause.projectId = projectId;

    const complaints = await prisma.complaint.findMany({
      where: whereClause,
      include: {
        customer: true,
        customerAsset: { include: { AMCContract: { orderBy: { createdAt: "desc" }, take: 1 } } },
        priority: true,
        status: true,
        category: true,
        complaintType: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        project: { select: { id: true, projectCode: true, name: true } },
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const complaintsWithEscalations = await computeEscalations(complaints);
    return NextResponse.json(complaintsWithEscalations);
  } catch (error: any) {
    console.error("Error fetching complaints:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    const _svcGuard2 = await enforceServiceEntitlement(user);
    if (_svcGuard2) return _svcGuard2;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      title,
      description,
      categoryId,
      complaintTypeId,
      priorityId,
      statusId,
      customerId,
      customerAssetId,
      projectId,
      assignedTeamId,
      assignedEngineerId,
      createdById,
    } = body;

    if (!title || !categoryId || !complaintTypeId || !priorityId || !statusId || !customerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (customerAssetId) {
      const quotaErr = await checkAmcQuota({
        customerAssetId,
        type: "breakdown",
        user: user as any,
        overrideQuota: body.overrideQuota === true,
      });
      if (quotaErr) return quotaErr;
    }

    // Use authenticated user, or fall back to provided createdById
    let finalCreatedById = createdById;
    if (!finalCreatedById || finalCreatedById === "user-1") {
      finalCreatedById = user.id;
    }

    // Auto-assignment logic: derive team from category via TeamToCategory mapping
    let actualTeamId = assignedTeamId;
    let actualEngineerId = assignedEngineerId;
    
    if (!actualTeamId && categoryId) {
      const categoryWithTeams = await prisma.serviceCategory.findUnique({
        where: { id: categoryId },
        include: { teams: { where: { isActive: true } } },
      });
      if (categoryWithTeams && categoryWithTeams.teams.length > 0) {
        actualTeamId = categoryWithTeams.teams[0].id;
      }
    }

    if (actualTeamId && !actualEngineerId) {
      const firstEngineer = await prisma.serviceEngineer.findFirst({
        where: { teamId: actualTeamId, isActive: true },
      });
      if (firstEngineer) {
        actualEngineerId = firstEngineer.id;
      }
    }

    const newComplaint = await prisma.complaint.create({
      data: {
        title,
        description,
        categoryId,
        complaintTypeId,
        priorityId,
        statusId,
        customerId,
        customerAssetId,
        projectId: projectId || null,
        assignedTeamId: actualTeamId,
        assignedEngineerId: actualEngineerId,
        createdById: finalCreatedById,
      },
      include: {
        customer: true,
        customerAsset: { include: { AMCContract: { orderBy: { createdAt: "desc" }, take: 1 } } },
        priority: true,
        status: true,
        category: true,
        complaintType: true,
        assignedTeam: true,
        assignedEngineer: {
          include: { user: true }
        },
        project: { select: { id: true, projectCode: true, name: true } },
        createdBy: true,
      }
    });

    return NextResponse.json(newComplaint);
  } catch (error: any) {
    console.error("Error creating complaint:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
