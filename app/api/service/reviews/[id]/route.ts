import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceServiceEntitlement } from "@/lib/serviceEntitlement";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const user = await verifyAuth();
    const _svcGuard = await enforceServiceEntitlement(user);
    if (_svcGuard) return _svcGuard;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const review = await prisma.serviceReview.findUnique({
      where: { id },
      include: {
        customer: true,
        engineer: { include: { user: true } },
        serviceRequest: true,
        complaint: true,
        defect: true,
        installation: true,
        serviceVisit: true,
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Role-based visibility check for Service Engineer
    if (user.role === "ServiceEngineer") {
      const eng = await prisma.serviceEngineer.findFirst({
        where: { userId: user.id }
      });
      if (!eng || review.engineerId !== eng.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(review);
  } catch (error: any) {
    console.error("Error fetching review detail:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    const user = await verifyAuth();
    const _svcGuard2 = await enforceServiceEntitlement(user);
    if (_svcGuard2) return _svcGuard2;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const existing = await prisma.serviceReview.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const isAdmin = ["Admin", "SuperAdmin", "ServiceManager"].includes(user.role);

    // Verify technician ownership or admin role
    if (user.role === "ServiceEngineer") {
      const eng = await prisma.serviceEngineer.findFirst({
        where: { userId: user.id }
      });
      if (!eng || existing.engineerId !== eng.id) {
        return NextResponse.json({ error: "Forbidden: You can only update feedback for your assigned visits." }, { status: 403 });
      }
    } else if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions to modify review." }, { status: 403 });
    }

    // Enforce single-use: if already submitted, cannot modify rating or comment
    if ((body.rating !== undefined || body.comment !== undefined) && existing.status === "Submitted") {
      return NextResponse.json({ error: "Review has already been submitted and cannot be modified." }, { status: 400 });
    }

    const updateData: any = {};

    // Customer / public submission
    if (body.rating !== undefined) {
      const rating = parseInt(body.rating, 10);
      if (rating < 1 || rating > 5) {
        return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
      }
      updateData.rating = rating;
      updateData.status = "Submitted";
      updateData.isEscalation = rating <= 2;
      updateData.submittedAt = new Date();
    }

    if (body.comment !== undefined) {
      updateData.comment = body.comment;
    }

    // Manager / Admin action (Resolving escalations)
    if (body.escalationResolved !== undefined) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized to resolve escalations" }, { status: 403 });
      }
      updateData.escalationResolved = body.escalationResolved;
    }

    const updated = await prisma.serviceReview.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        engineer: { include: { user: true } },
        serviceRequest: true,
        complaint: true,
        defect: true,
        installation: true,
        serviceVisit: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating review:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
