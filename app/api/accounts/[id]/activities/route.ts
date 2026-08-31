import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/accounts/[id]/activities
// Returns a unified timeline of all activity for an account
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

    const [callLogs, followUps, deals, quotations, rfqs, visits] = await Promise.all([
      prisma.callLog.findMany({
        where: { customerId: id },
        orderBy: { timestamp: "desc" },
        include: { user: { select: { name: true } } },
        take: 20,
      }),
      prisma.followUp.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
        include: { assignedUser: { select: { name: true } } },
        take: 20,
      }),
      prisma.deal.findMany({
        where: { customerId: id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, dealName: true, status: true, dealValue: true, updatedAt: true },
        take: 20,
      }),
      prisma.quotation.findMany({
        where: { customerId: id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, quotationCode: true, status: true, totalAmount: true, createdAt: true },
        take: 20,
      }),
      prisma.rFQ.findMany({
        where: { customerId: id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, rfqCode: true, status: true, createdAt: true },
        take: 20,
      }),
      prisma.customerVisit.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, purpose: true, status: true, createdAt: true },
        take: 20,
      }),
    ]);

    // Merge into a unified timeline
    const timeline: Array<{ id: string; type: string; title: string; description: string; timestamp: string; userName?: string }> = [];

    callLogs.forEach((c) => timeline.push({
      id: c.id, type: "call", title: "Call Logged", description: c.notes || "", timestamp: c.timestamp.toISOString(), userName: c.user?.name,
    }));
    followUps.forEach((f) => timeline.push({
      id: f.id, type: "followup", title: "Follow Up", description: f.notes || "", timestamp: f.createdAt.toISOString(), userName: f.assignedUser?.name,
    }));
    deals.forEach((d) => timeline.push({
      id: d.id, type: "deal", title: `Deal: ${d.dealName}`, description: `Status: ${d.status}, Value: ₹${d.dealValue}`, timestamp: d.updatedAt.toISOString(),
    }));
    quotations.forEach((q) => timeline.push({
      id: q.id, type: "quotation", title: `Quotation: ${q.quotationCode}`, description: `Status: ${q.status}, Amount: ₹${q.totalAmount}`, timestamp: q.createdAt.toISOString(),
    }));
    rfqs.forEach((r) => timeline.push({
      id: r.id, type: "rfq", title: `RFQ: ${r.rfqCode}`, description: `Status: ${r.status}`, timestamp: r.createdAt.toISOString(),
    }));
    visits.forEach((v) => timeline.push({
      id: v.id, type: "visit", title: `Visit: ${v.purpose || "Customer Visit"}`, description: `Status: ${v.status}`, timestamp: v.createdAt.toISOString(),
    }));

    // Sort by timestamp desc
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      data: timeline.slice(0, 50),
      count: timeline.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
