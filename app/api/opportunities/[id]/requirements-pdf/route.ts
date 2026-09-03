import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { generateRequirementsPdf } from "@/lib/generateRequirementsPdf";

// GET /api/opportunities/[id]/requirements-pdf
// Generates a Requirements Summary PDF on-demand from the opportunity's
// lead, customer, contact, opportunity detail, and meeting logs.
// Available for all variants — does not require the Documents module.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    // SuperAdmin must use support/impersonation mode
    if (user.role === "SuperAdmin" && (!user.supportMode || !user.companyId)) {
      return NextResponse.json({ success: false, message: "SuperAdmin must access business data via support/impersonation mode." }, { status: 403 });
    }

    const { id } = await params;

    const deal = await prisma.deal.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      include: {
        customer: {
          select: {
            id: true, name: true, customerCode: true, phone: true, email: true,
            city: true, industryType: true, convertedFromLead: true,
          },
        },
        opportunityDetail: true,
        meetingLogs: { orderBy: { attemptNumber: "asc" } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!deal) {
      return NextResponse.json({ success: false, message: "Opportunity not found" }, { status: 404 });
    }

    // Row-level scope check
    if (user.role === "SalesExecutive" && deal.assignedUserId !== user.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    // Fetch the originating lead (if deal was created from lead conversion)
    let lead: any = null;
    if (deal.customer?.convertedFromLead) {
      lead = await prisma.lead.findUnique({
        where: { id: deal.customer.convertedFromLead },
        select: {
          id: true, name: true, companyName: true, email: true, phone: true,
          city: true, industryType: true, designation: true, leadSource: true,
          estimatedValue: true, budgetAsked: true, timelineAsked: true, notes: true,
        },
      });
    }

    // Fetch primary contact from OpportunityContact or customer contacts
    let contact: any = null;
    const oppContact = await prisma.opportunityContact.findFirst({
      where: { dealId: deal.id },
      include: { contact: { select: { id: true, name: true, email: true, phone: true, designation: true } } },
      orderBy: { isPrimary: "desc" },
    });
    if (oppContact) {
      contact = oppContact.contact;
    } else if (deal.customerId) {
      contact = await prisma.contact.findFirst({
        where: { customerId: deal.customerId, isPrimary: true, deletedAt: null },
        select: { id: true, name: true, email: true, phone: true, designation: true },
      });
      if (!contact) {
        contact = await prisma.contact.findFirst({
          where: { customerId: deal.customerId, deletedAt: null },
          select: { id: true, name: true, email: true, phone: true, designation: true },
        });
      }
    }

    // Fetch company info from SystemConfig
    const [addrConfig, phoneConfig, emailConfig] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: "company_address" } }),
      prisma.systemConfig.findUnique({ where: { key: "company_phone" } }),
      prisma.systemConfig.findUnique({ where: { key: "company_email" } }),
    ]);

    const generatedByName = (await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name || user.email;

    const doc = generateRequirementsPdf({
      opportunityCode: deal.opportunityCode || deal.id,
      dealName: deal.dealName,
      stage: deal.status,
      dealValue: deal.dealValue,
      expectedCloseDate: deal.expectedCloseDate,
      createdAt: deal.createdAt,
      customer: deal.customer,
      lead,
      contact,
      detail: deal.opportunityDetail,
      meetingLogs: deal.meetingLogs,
      company: deal.company,
      companyAddress: addrConfig?.value || "",
      companyPhone: phoneConfig?.value || "",
      companyEmail: emailConfig?.value || "",
      generatedByName,
    });

    const pdfBytes = doc.output("arraybuffer");
    const fileName = `${deal.opportunityCode || deal.id}-Requirements-Summary.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  } catch (error: any) {
    console.error("[requirements-pdf] error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate requirements PDF" },
      { status: 500 }
    );
  }
}
