import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: { leads: [], customers: [], deals: [], contacts: [], pos: [], quotations: [], visits: [], visitors: [] } });
    }

    const isExec = userPayload.role === "SalesExecutive";
    const userId = userPayload.id;
    const companyId = userPayload.companyId;

    const [leads, customers, deals, contacts, pos, quotations, visits, visitors] = await Promise.all([
      prisma.lead.findMany({
        where: {
          AND: [
            isExec ? { assignedUserId: userId } : {},
            { companyId },
            { OR: [{ name: { contains: q } }, { leadCode: { contains: q } }, { email: { contains: q } }] },
          ]
        },
        take: 5,
        select: { id: true, name: true, leadCode: true, email: true, phone: true, status: true },
      }),
      prisma.customer.findMany({
        where: {
          AND: [
            isExec ? { assignedUserId: userId } : {},
            { companyId },
            { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { customerCode: { contains: q } }] },
          ]
        },
        take: 5,
        select: { id: true, name: true, customerCode: true, email: true, phone: true, city: true },
      }),
      prisma.deal.findMany({
        where: {
          AND: [
            isExec ? { assignedUserId: userId } : {},
            { companyId },
            { OR: [{ dealName: { contains: q } }] },
          ]
        },
        take: 5,
        select: { id: true, dealName: true, status: true, dealValue: true },
      }),
      prisma.contact.findMany({
        where: {
          AND: [
            { companyId },
            { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] },
          ]
        },
        take: 5,
        select: { id: true, name: true, email: true, phone: true, contactType: true, customerId: true },
      }),
      prisma.purchaseOrder.findMany({
        where: {
          AND: [
            { companyId },
            { OR: [{ poCode: { contains: q } }, { poNumber: { contains: q } }] },
          ]
        },
        take: 5,
        select: { id: true, poCode: true, poNumber: true, status: true, totalAmount: true },
      }),
      prisma.quotation.findMany({
        where: {
          AND: [
            { companyId },
            { OR: [{ quotationCode: { contains: q } }] },
          ]
        },
        take: 5,
        select: { id: true, quotationCode: true, status: true, finalAmount: true },
      }),
      prisma.marketingVisit.findMany({
        where: {
          AND: [
            isExec ? { executiveId: userId } : {},
            { OR: [{ customer: { name: { contains: q } } }, { executive: { name: { contains: q } } }] },
          ]
        },
        include: { customer: { select: { name: true } }, executive: { select: { name: true } } },
        take: 5,
      }),
      prisma.visitor.findMany({
        where: {
          AND: [
            isExec ? { hostUserId: userId } : {},
            { OR: [{ visitorName: { contains: q } }, { company: { contains: q } }] },
          ]
        },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { leads, customers, deals, contacts, pos, quotations, visits, visitors }
    });

  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ success: false, message: "Search failed" }, { status: 500 });
  }
}
