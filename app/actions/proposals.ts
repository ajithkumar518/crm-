"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getProposalsAction(params?: { search?: string; status?: string }) {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, message: "Unauthorized", data: [] as any[] };
    if (user.role === "Customer") return { success: false, message: "Unauthorized", data: [] as any[] };

    const where: any = { deletedAt: null, companyId: user.companyId };
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { title: { contains: params.search } },
        { proposalNumber: { contains: params.search } },
        { customer: { name: { contains: params.search } } },
      ];
    }

    const proposals = await prisma.proposal.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        deal: { select: { id: true, dealName: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { changedBy: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: proposals };
  } catch (error) {
    console.error("getProposalsAction error:", error);
    return { success: false, message: "Failed to fetch proposals", data: [] as any[] };
  }
}

export async function getProposalByIdAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, message: "Unauthorized" };

    const proposal = await prisma.proposal.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
      include: {
        customer: { select: { id: true, name: true } },
        deal: { select: { id: true, dealName: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: { changedBy: { select: { id: true, name: true } } },
        },
      },
    });

    if (!proposal) return { success: false, message: "Proposal not found" };
    return { success: true, data: proposal };
  } catch (error) {
    console.error("getProposalByIdAction error:", error);
    return { success: false, message: "Failed to fetch proposal" };
  }
}

export async function createProposalAction(data: {
  customerId: string;
  dealId?: string;
  title: string;
  description?: string;
  value: number;
  validUntil: string;
  proposalPdfUrl?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, message: "Unauthorized" };
    if (user.role === "Customer") return { success: false, message: "Unauthorized" };

    if (!data.customerId || !data.title || !data.validUntil) {
      return { success: false, message: "Missing required fields: customerId, title, validUntil" };
    }

    const count = await prisma.proposal.count({ where: { companyId: user.companyId } });
    const proposalNumber = `PROP-${String(count + 1).padStart(5, "0")}`;

    const proposal = await prisma.proposal.create({
      data: {
        proposalNumber,
        customerId: data.customerId,
        dealId: data.dealId || null,
        title: data.title,
        description: data.description || null,
        value: data.value || 0,
        validUntil: new Date(data.validUntil),
        proposalPdfUrl: data.proposalPdfUrl || null,
        status: "Draft",
        companyId: user.companyId,
      },
    });

    await prisma.proposalVersion.create({
      data: {
        proposalId: proposal.id,
        versionNumber: 1,
        title: data.title,
        description: data.description || null,
        value: data.value || 0,
        validUntil: new Date(data.validUntil),
        proposalPdfUrl: data.proposalPdfUrl || null,
        status: "Draft",
        changedById: user.id,
      },
    });

    await logAudit(user.id, "Proposal", "Create", `Created proposal ${proposalNumber}`, {
      resourceId: proposal.id,
      newState: { title: data.title, value: data.value, status: "Draft" },
    });

    revalidatePath("/proposals");
    return { success: true, data: proposal, message: "Proposal created successfully" };
  } catch (error) {
    console.error("createProposalAction error:", error);
    return { success: false, message: "Failed to create proposal" };
  }
}

export async function updateProposalAction(data: {
  id: string;
  title?: string;
  description?: string;
  value?: number;
  validUntil?: string;
  proposalPdfUrl?: string;
  status?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, message: "Unauthorized" };

    const existing = await prisma.proposal.findFirst({
      where: { id: data.id, deletedAt: null, companyId: user.companyId },
    });
    if (!existing) return { success: false, message: "Proposal not found" };

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.validUntil !== undefined) updateData.validUntil = new Date(data.validUntil);
    if (data.proposalPdfUrl !== undefined) updateData.proposalPdfUrl = data.proposalPdfUrl;
    if (data.status !== undefined) updateData.status = data.status;

    const proposal = await prisma.proposal.update({
      where: { id: data.id },
      data: updateData,
    });

    // Create a new version if key fields changed
    if (data.title || data.value !== undefined || data.validUntil || data.description !== undefined) {
      const latestVersion = await prisma.proposalVersion.findFirst({
        where: { proposalId: data.id },
        orderBy: { versionNumber: "desc" },
      });
      const nextVersion = (latestVersion?.versionNumber || 0) + 1;

      await prisma.proposalVersion.create({
        data: {
          proposalId: data.id,
          versionNumber: nextVersion,
          title: data.title || existing.title,
          description: data.description !== undefined ? data.description : existing.description,
          value: data.value !== undefined ? data.value : existing.value,
          validUntil: data.validUntil ? new Date(data.validUntil) : existing.validUntil,
          proposalPdfUrl: data.proposalPdfUrl !== undefined ? data.proposalPdfUrl : existing.proposalPdfUrl,
          status: data.status || existing.status,
          changedById: user.id,
        },
      });
    }

    await logAudit(user.id, "Proposal", "Update", `Updated proposal ${existing.proposalNumber}`, {
      resourceId: data.id,
      previousState: { title: existing.title, value: existing.value, status: existing.status },
      newState: updateData,
    });

    revalidatePath("/proposals");
    revalidatePath(`/proposals/${data.id}`);
    return { success: true, data: proposal, message: "Proposal updated successfully" };
  } catch (error) {
    console.error("updateProposalAction error:", error);
    return { success: false, message: "Failed to update proposal" };
  }
}

export async function advanceProposalStatusAction(id: string, newStatus: string) {
  try {
    const user = await verifyAuth();
    if (!user) return { success: false, message: "Unauthorized" };

    const existing = await prisma.proposal.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
    });
    if (!existing) return { success: false, message: "Proposal not found" };

    const validStatuses = ["Draft", "Sent", "CustomerReviewing", "RevisionRequested", "Accepted", "Rejected", "Expired"];
    if (!validStatuses.includes(newStatus)) {
      return { success: false, message: `Invalid status: ${newStatus}` };
    }

    const proposal = await prisma.proposal.update({
      where: { id },
      data: { status: newStatus },
    });

    // Log version for status change
    const latestVersion = await prisma.proposalVersion.findFirst({
      where: { proposalId: id },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersion = (latestVersion?.versionNumber || 0) + 1;

    await prisma.proposalVersion.create({
      data: {
        proposalId: id,
        versionNumber: nextVersion,
        title: existing.title,
        description: existing.description,
        value: existing.value,
        validUntil: existing.validUntil,
        proposalPdfUrl: existing.proposalPdfUrl,
        status: newStatus,
        changedById: user.id,
      },
    });

    await logAudit(user.id, "Proposal", "StatusChange", `Advanced proposal ${existing.proposalNumber} to ${newStatus}`, {
      resourceId: id,
      previousState: { status: existing.status },
      newState: { status: newStatus },
    });

    revalidatePath("/proposals");
    revalidatePath(`/proposals/${id}`);
    return { success: true, data: proposal, message: `Proposal marked as ${newStatus}` };
  } catch (error) {
    console.error("advanceProposalStatusAction error:", error);
    return { success: false, message: "Failed to update proposal status" };
  }
}

export async function deleteProposalAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer" || user.role === "SalesExecutive") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.proposal.findFirst({
      where: { id, deletedAt: null, companyId: user.companyId },
    });
    if (!existing) return { success: false, message: "Proposal not found" };

    await prisma.proposal.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    await logAudit(user.id, "Proposal", "Delete", `Deleted proposal ${existing.proposalNumber}`, {
      resourceId: id,
    });

    revalidatePath("/proposals");
    return { success: true, message: "Proposal deleted successfully" };
  } catch (error) {
    console.error("deleteProposalAction error:", error);
    return { success: false, message: "Failed to delete proposal" };
  }
}