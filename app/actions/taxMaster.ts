"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { hasModule } from "@/lib/modules";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function getTaxMasterAction(onlyActive = false) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) return { success: false, message: "Unauthorized" };
    if (!hasModule(userPayload, MODULE_KEYS.MANAGER_DASHBOARD)) {
      return { success: false, message: "This feature is not included in your current plan." };
    }

    const where: any = {
      OR: [{ companyId: userPayload.companyId }, { companyId: null }],
    };
    if (onlyActive) where.isActive = true;

    const taxes = await prisma.taxMaster.findMany({
      where,
      orderBy: { taxPercent: "asc" },
    });

    return { success: true, data: taxes };
  } catch (error: any) {
    console.error("GET TaxMaster Error:", error);
    return { success: false, message: "Failed to fetch tax rates" };
  }
}

export async function createTaxMasterAction(data: {
  taxName: string;
  taxPercent: number;
  hsnCode?: string;
  effectiveFrom?: string;
}) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "Admin or SalesManager only" };
    }
    if (!hasModule(userPayload, MODULE_KEYS.MANAGER_DASHBOARD)) {
      return { success: false, message: "This feature is not included in your current plan." };
    }
    if (!data.taxName?.trim()) return { success: false, message: "Tax name is required" };
    if (data.taxPercent < 0 || data.taxPercent > 100)
      return { success: false, message: "Tax percent must be 0–100" };

    const tax = await prisma.taxMaster.create({
      data: {
        taxName: data.taxName.trim(),
        taxPercent: data.taxPercent,
        hsnCode: data.hsnCode?.trim() || null,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        isActive: true,
        companyId: userPayload.companyId,
      },
    });

    await logAudit(userPayload.id, "settings", "create", `Created tax: ${data.taxName} @ ${data.taxPercent}%`);
    revalidatePath("/settings/tax-master");
    return { success: true, message: "Tax rate created", data: tax };
  } catch (error: any) {
    console.error("CREATE TaxMaster Error:", error);
    return { success: false, message: "Failed to create tax rate" };
  }
}

export async function updateTaxMasterAction(
  id: string,
  data: { taxName?: string; taxPercent?: number; hsnCode?: string; effectiveFrom?: string; isActive?: boolean }
) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SalesManager"].includes(userPayload.role)) {
      return { success: false, message: "Admin or SalesManager only" };
    }
    if (!hasModule(userPayload, MODULE_KEYS.MANAGER_DASHBOARD)) {
      return { success: false, message: "This feature is not included in your current plan." };
    }

    const existing = await prisma.taxMaster.findUnique({ where: { id } });
    if (!existing) return { success: false, message: "Tax rate not found" };
    if (existing.companyId && existing.companyId !== userPayload.companyId)
      return { success: false, message: "Unauthorized" };

    const updateData: any = {};
    if (data.taxName !== undefined) updateData.taxName = data.taxName.trim();
    if (data.taxPercent !== undefined) updateData.taxPercent = data.taxPercent;
    if (data.hsnCode !== undefined) updateData.hsnCode = data.hsnCode?.trim() || null;
    if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.taxMaster.update({ where: { id }, data: updateData });
    await logAudit(userPayload.id, "settings", "update", `Updated tax ${id}: ${JSON.stringify(data)}`);
    revalidatePath("/settings/tax-master");
    return { success: true, message: "Tax rate updated", data: updated };
  } catch (error: any) {
    console.error("UPDATE TaxMaster Error:", error);
    return { success: false, message: "Failed to update tax rate" };
  }
}

export async function deleteTaxMasterAction(id: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || userPayload.role !== "Admin") {
      return { success: false, message: "Admin only" };
    }
    if (!hasModule(userPayload, MODULE_KEYS.MANAGER_DASHBOARD)) {
      return { success: false, message: "This feature is not included in your current plan." };
    }

    const existing = await prisma.taxMaster.findUnique({ where: { id } });
    if (!existing) return { success: false, message: "Tax rate not found" };

    await prisma.taxMaster.delete({ where: { id } });
    await logAudit(userPayload.id, "settings", "delete", `Deleted tax ${id}`);
    revalidatePath("/settings/tax-master");
    return { success: true, message: "Tax rate deleted" };
  } catch (error: any) {
    console.error("DELETE TaxMaster Error:", error);
    return { success: false, message: "Failed to delete tax rate" };
  }
}
