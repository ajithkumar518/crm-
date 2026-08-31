import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { buildScope } from "@/lib/scopes";

export async function GET(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status");
    const leadSource = url.searchParams.get("leadSource");
    const assignedUserId = url.searchParams.get("assignedUserId");

    // Build the standard base scope for the user (Tenant + RBAC)
    const scope = buildScope(userPayload, "Lead");

    // Build filtering conditions for the table query
    const where: any = {
      ...scope,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (status && status !== "All") {
      where.status = status;
    }

    if (leadSource && leadSource !== "All") {
      where.leadSource = leadSource;
    }

    if (assignedUserId && assignedUserId !== "All") {
      where.assignedUserId = assignedUserId;
    }

    // Query Leads matching the filters
    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate Summary Metrics (always scoped to user/company scope, but ignoring table-specific status/source/date filters for baseline metrics)
    const baseWhere = { ...scope };

    const totalLeads = await prisma.lead.count({
      where: baseWhere,
    });

    const sqlCount = await prisma.lead.count({
      where: {
        ...baseWhere,
        status: {
          in: ["Qualified", "SQL"],
        },
      },
    });

    const conversionRate = totalLeads > 0 ? Math.round((sqlCount / totalLeads) * 1000) / 10 : 0;

    // By source
    const allLeadsForSource = await prisma.lead.findMany({ where: baseWhere, select: { leadSource: true } });
    const bySource: Record<string, number> = {};
    for (const l of allLeadsForSource) {
      const src = l.leadSource || "Unknown";
      bySource[src] = (bySource[src] || 0) + 1;
    }

    // By status
    const allLeadsForStatus = await prisma.lead.findMany({ where: baseWhere, select: { status: true } });
    const byStatus: Record<string, number> = {};
    for (const l of allLeadsForStatus) {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    }

    const now = new Date();
    const formattedLeads = leads.map((l) => {
      const daysInStatus = Math.floor((now.getTime() - new Date(l.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: l.id,
        leadCode: l.leadCode || "—",
        companyName: l.companyName || l.name || "—",
        sourceName: l.leadSource || "—",
        leadStatus: l.status,
        leadScore: l.leadScore || 0,
        assignedToName: l.assignedUser?.name || "—",
        createdAt: new Date(l.createdAt).toISOString(),
        daysInCurrentStatus: daysInStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        leads: formattedLeads,
        summary: {
          totalLeads,
          sqlCount,
          conversionRate,
          bySource,
          byStatus,
        },
      },
    });
  } catch (error: any) {
    console.error("GET Lead Report Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
