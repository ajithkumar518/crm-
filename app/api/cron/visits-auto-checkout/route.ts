import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";

// GET /api/cron/visits-auto-checkout
// Runs every 30 minutes. Handles 4-hour warning, 8-hour manager alert,
// and 9-hour auto-checkout for visits stuck in CHECKED_IN.
export async function GET() {
  try {
    const now = new Date();

    const checkedInVisits = await prisma.customerVisit.findMany({
      where: {
        status: "CHECKED_IN",
        deletedAt: null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        host: { select: { id: true, name: true } },
      },
    });

    let autoCheckedOut = 0;
    let warningsSent = 0;
    let alertsSent = 0;

    for (const visit of checkedInVisits) {
      if (!visit.checkInTime) continue;

      const checkInTime = new Date(visit.checkInTime);
      const elapsedMs = now.getTime() - checkInTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      const accountName = visit.customer?.name || "Unknown Account";
      const execName = visit.host?.name || "Sales Executive";
      const execId = visit.hostedBy;

      // 9+ hours: auto checkout
      if (elapsedHours >= 9) {
        const checkoutTime = new Date(checkInTime.getTime() + 9 * 60 * 60 * 1000);
        const checkInGps = visit.gpsLat != null && visit.gpsLng != null
          ? `${visit.gpsLat},${visit.gpsLng}`
          : null;

        await prisma.customerVisit.update({
          where: { id: visit.id },
          data: {
            status: "CHECKED_OUT",
            checkOutTime: checkoutTime,
            checkOutGpsLocation: checkInGps,
            durationMinutes: 540,
            autoCheckedOut: true,
            autoCheckoutReason: "Auto checked out by system after 9 hours",
            longVisit: true,
          },
        });

        autoCheckedOut++;

        if (execId) {
          await dispatchNotification({
            userId: execId,
            title: "Visit Auto Checked Out",
            message: `Your visit at ${accountName} was automatically checked out after 9 hours. Please complete the visit and provide a justification for the extended duration.`,
            type: "visit",
            link: `/visits/${visit.id}`,
          });
        }

        const managers = await prisma.user.findMany({
          where: { role: "SalesManager", deletedAt: null },
          select: { id: true },
        });
        if (managers.length > 0) {
          await dispatchNotificationsToMany({
            userIds: managers.map((m) => m.id),
            title: "Visit Auto Checked Out",
            message: `${execName}'s visit at ${accountName} was auto checked out after 9 hours. Please review.`,
            type: "visit",
            link: `/visits/${visit.id}`,
          });
        }

        continue;
      }

      // 8+ hours: manager alert (once per visit)
      if (elapsedHours >= 8 && !visit.visited8HrAlertSent) {
        const managers = await prisma.user.findMany({
          where: { role: "SalesManager", deletedAt: null },
          select: { id: true },
        });
        if (managers.length > 0) {
          await dispatchNotificationsToMany({
            userIds: managers.map((m) => m.id),
            title: "Visit Check-in Exceeds 8 Hours",
            message: `${execName} has been checked in at ${accountName} for 8+ hours with no checkout. Auto checkout will happen in 1 hour.`,
            type: "visit",
            link: `/visits/${visit.id}`,
          });
        }

        await prisma.customerVisit.update({
          where: { id: visit.id },
          data: { visited8HrAlertSent: true },
        });

        alertsSent++;
        continue;
      }

      // 4+ hours: sales exec warning (once per visit)
      if (elapsedHours >= 4 && !visit.visited4HrWarningSent) {
        if (execId) {
          await dispatchNotification({
            userId: execId,
            title: "Long Visit Check-in",
            message: `You have been checked in at ${accountName} for 4 hours. Please check out if your visit is complete.`,
            type: "visit",
            link: `/visits/${visit.id}`,
          });
        }

        await prisma.customerVisit.update({
          where: { id: visit.id },
          data: { visited4HrWarningSent: true },
        });

        warningsSent++;
      }
    }

    return NextResponse.json({
      success: true,
      autoCheckedOut,
      warningsSent,
      alertsSent,
    });
  } catch (error: any) {
    console.error("[Visits Auto Checkout Cron Error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
