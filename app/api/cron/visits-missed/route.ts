import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchNotification, dispatchNotificationsToMany } from "@/lib/notifications";

export async function GET() {
  const now = new Date();

  // Find all PLANNED visits whose plannedDate has passed (more than 1 day ago)
  const missedVisits = await prisma.customerVisit.findMany({
    where: {
      status: "PLANNED",
      plannedDate: { lt: now },
      checkInTime: null,
      deletedAt: null,
    },
    include: {
      customer: { select: { name: true } },
      host: { select: { id: true, name: true } },
    },
  });

  let updated = 0;
  const salesManagerIds = new Set<string>();

  // Collect sales managers for batch notification
  const managers = await prisma.user.findMany({
    where: { role: "SalesManager", deletedAt: null },
    select: { id: true },
  });
  managers.forEach((m) => salesManagerIds.add(m.id));

  for (const visit of missedVisits) {
    await prisma.customerVisit.update({
      where: { id: visit.id },
      data: { status: "MISSED" },
    });
    updated++;

    // Notify assigned user
    if (visit.hostedBy) {
      await dispatchNotification({
        userId: visit.hostedBy,
        title: "Visit Missed",
        message: `Visit to ${visit.customer?.name} planned for ${visit.plannedDate?.toLocaleDateString()} was not checked in and has been marked as missed.`,
        type: "visit",
        link: `/visits/${visit.id}`,
      });
    }
  }

  // Notify sales managers about all missed visits (batch)
  if (missedVisits.length > 0 && salesManagerIds.size > 0) {
    await dispatchNotificationsToMany({
      userIds: Array.from(salesManagerIds),
      title: "Missed Visits Alert",
      message: `${missedVisits.length} visit${missedVisits.length !== 1 ? "s" : ""} marked as missed in the nightly batch.`,
      type: "visit",
      link: `/visits?status=MISSED`,
    });
  }

  // ─── Key Account 30-Day Visit Compliance Check ───────────────────────────
  // Find key accounts (isKeyAccountV2 = true) with no visit in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const keyAccountsNeedingVisit = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      isKeyAccountV2: true,
      status: { in: ["Active", "ActiveCustomer"] },
      NOT: {
        customerVisits: {
          some: {
            plannedDate: { gte: thirtyDaysAgo },
            deletedAt: null,
          },
        },
      },
    },
    select: { id: true, name: true, customerCode: true, assignedUserId: true },
  });

  let keyAccountAlerts = 0;
  for (const account of keyAccountsNeedingVisit) {
    // Check if we already sent a 30-day alert in the last 7 days
    const existingAlert = await prisma.notification.findFirst({
      where: {
        title: "Key Account — No Visit in 30 Days",
        link: `/customer-master/${account.id}`,
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    if (existingAlert) continue;

    if (account.assignedUserId) {
      await dispatchNotification({
        userId: account.assignedUserId,
        title: "Key Account — No Visit in 30 Days",
        message: `Key account ${account.name} (${account.customerCode}) has not had a visit in 30+ days. Schedule a visit soon.`,
        type: "visit",
        link: `/customer-master/${account.id}`,
      });
      keyAccountAlerts++;
    }

    // Notify managers
    await dispatchNotificationsToMany({
      userIds: Array.from(salesManagerIds),
      title: "Key Account Visit Overdue",
      message: `Key account ${account.name} (${account.customerCode}) has not been visited in 30+ days.`,
      type: "visit",
      link: `/customer-master/${account.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, updated, keyAccountAlerts });
}
