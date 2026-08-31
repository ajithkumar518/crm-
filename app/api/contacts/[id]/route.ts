import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/contacts/[id]
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

    const contact = await prisma.contact.findUnique({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, customerCode: true, city: true, status: true, accountType: true, industryType: true } },
        rfqs: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, rfqCode: true, status: true, requirementDetails: true, createdAt: true },
        },
        quotations: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, quotationCode: true, status: true, totalAmount: true, createdAt: true },
        },
        Task: {
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
        },
      },
    });

    if (!contact || contact.ownerId !== user.id) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: contact });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT /api/contacts/[id]
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

    const existing = await prisma.contact.findUnique({ where: { id, deletedAt: null } });
    if (!existing || existing.ownerId !== user.id) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    // Auto-detect decision-maker from designation
    let isDecisionMaker = body.isDecisionMaker;
    if (body.designation && isDecisionMaker === undefined) {
      const decisionMakerKeywords = ["Head", "Director", "VP", "GM", "President", "CEO", "MD", "CTO", "COO"];
      isDecisionMaker = decisionMakerKeywords.some((keyword) =>
        body.designation.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    // If setting isPrimary=true, unset old primary for the same account
    if (body.isPrimary === true && existing.customerId) {
      await prisma.contact.updateMany({
        where: {
          customerId: existing.customerId,
          id: { not: id },
          isPrimary: true,
          deletedAt: null,
        },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.company !== undefined && { company: body.company }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.designation !== undefined && { designation: body.designation }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.contactType !== undefined && { contactType: body.contactType }),
        ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary }),
        ...(isDecisionMaker !== undefined && { isDecisionMaker }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.customerId !== undefined && { customerId: body.customerId }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/contacts/[id]
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

    const existing = await prisma.contact.findUnique({ where: { id, deletedAt: null } });
    if (!existing || existing.ownerId !== user.id) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    // Check for active quotation references
    const activeQuotations = await prisma.quotation.count({
      where: {
        contactId: id,
        status: { notIn: ["Rejected", "Expired", "Cancelled"] },
        deletedAt: null,
      },
    });

    // Check for active RFQ references
    const activeRfqs = await prisma.rFQ.count({
      where: {
        contactId: id,
        status: { not: "Closed" },
        deletedAt: null,
      },
    });

    if (activeQuotations > 0 || activeRfqs > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Reassign contact from active quotations/RFQs first",
          count: activeQuotations + activeRfqs,
        },
        { status: 409 }
      );
    }

    await prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
