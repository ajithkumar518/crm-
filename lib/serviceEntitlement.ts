import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface ServiceEntitlementSubject {
  id?: string;
  companyId?: string | null;
  serviceCrmEnabled?: boolean;
  disableServiceCrm?: boolean;
  company?: {
    serviceCrmEnabled?: boolean;
  } | null;
}

/**
 * Enforces Service CRM entitlement gating for API routes and server actions.
 * Fail-closed design: if serviceCrmEnabled is not explicitly true, returns a 403 response.
 */
export async function enforceServiceEntitlement(
  subject: ServiceEntitlementSubject | null | undefined
): Promise<NextResponse | null> {
  if (!subject) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or unentitled access to Service CRM." },
      { status: 403 }
    );
  }

  // 0. Per-user kill switch — takes precedence over any company-level entitlement.
  if (subject.disableServiceCrm === true) {
    return NextResponse.json(
      { success: false, error: "Service CRM module is not enabled for your account." },
      { status: 403 }
    );
  }

  // 1. Check direct property on subject (e.g. from JWT TokenPayload or flattened user object)
  if (subject.serviceCrmEnabled !== undefined) {
    if (!subject.serviceCrmEnabled) {
      return NextResponse.json(
        { success: false, error: "Service CRM module is not enabled for your account." },
        { status: 403 }
      );
    }
    return null; // Entitled
  }

  // 2. Check nested company property (e.g. if company relation was populated)
  if (subject.company && subject.company.serviceCrmEnabled !== undefined) {
    if (!subject.company.serviceCrmEnabled) {
      return NextResponse.json(
        { success: false, error: "Service CRM module is not enabled for your account." },
        { status: 403 }
      );
    }
    return null; // Entitled
  }

  // 3. Fallback: if property is missing (legacy session or unpopulated relation), query DB by companyId.
  // Fails closed by default: if companyId is missing or DB returns false/null, return 403.
  if (subject.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: subject.companyId },
      select: { serviceCrmEnabled: true }
    });
    if (!company?.serviceCrmEnabled) {
      return NextResponse.json(
        { success: false, error: "Service CRM module is not enabled for your account." },
        { status: 403 }
      );
    }
    return null; // Entitled
  }

  // Default fail-closed: reject access
  return NextResponse.json(
    { success: false, error: "Service CRM module is not enabled for your account." },
    { status: 403 }
  );
}
