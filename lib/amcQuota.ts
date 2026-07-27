import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export interface AmcQuotaCheckOptions {
  customerAssetId?: string | null;
  type: "breakdown" | "preventive";
  user: { id: string; email: string; role: string } | null;
  overrideQuota?: boolean;
}

/**
 * Validates whether the asset has available AMC quota for the specified call type.
 * Returns null if quota is available or if valid admin/manager override is applied.
 * Returns a NextResponse (403) if quota is exhausted without override.
 */
export async function checkAmcQuota({
  customerAssetId,
  type,
  user,
  overrideQuota = false,
}: AmcQuotaCheckOptions): Promise<NextResponse | null> {
  if (!customerAssetId) return null; // If not tied to an asset, quota does not apply

  const now = new Date();
  const activeAmc = await prisma.aMCContract.findFirst({
    where: {
      customerAssetId,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { endDate: "desc" },
  });

  if (!activeAmc) return null; // No active AMC contract on this asset, standard billing / out of warranty

  let exhausted = false;
  let reason = "";

  if (type === "breakdown") {
    if (!activeAmc.breakdownCallsUnlimited && activeAmc.breakdownCallsIncluded > 0) {
      if (activeAmc.breakdownCallsUsed >= activeAmc.breakdownCallsIncluded) {
        exhausted = true;
        reason = `AMC breakdown call quota exhausted (${activeAmc.breakdownCallsUsed}/${activeAmc.breakdownCallsIncluded}).`;
      }
    }
  } else if (type === "preventive") {
    if (activeAmc.preventiveVisitsIncluded > 0) {
      if (activeAmc.preventiveVisitsUsed >= activeAmc.preventiveVisitsIncluded) {
        exhausted = true;
        reason = `AMC preventive visit quota exhausted (${activeAmc.preventiveVisitsUsed}/${activeAmc.preventiveVisitsIncluded}).`;
      }
    }
  }

  if (!exhausted) return null;

  // Quota is exhausted. Check for override.
  const canOverride = user && ["Admin", "SuperAdmin", "ServiceManager"].includes(user.role);

  if (overrideQuota && canOverride) {
    // Admin/Manager override invoked. Log audit!
    await logAudit(
      user!.id,
      "AMC_QUOTA_OVERRIDE",
      "OVERRIDE_EXHAUSTED_QUOTA",
      `User ${user!.email} (${user!.role}) overrode ${type} AMC quota exhaustion for asset ${customerAssetId} on contract ${activeAmc.contractNumber}. Reason: ${reason}`,
      {
        resourceId: activeAmc.id,
        severity: "WARN",
        newState: {
          contractNumber: activeAmc.contractNumber,
          callType: type,
          assetId: customerAssetId,
          reason,
        },
      }
    );
    return null; // Allowed via override!
  }

  return NextResponse.json(
    {
      error: `${reason} Renewal or Manager/Admin override required.`,
      quotaExhausted: true,
      contractNumber: activeAmc.contractNumber,
      requiresOverride: true,
    },
    { status: 403 }
  );
}
