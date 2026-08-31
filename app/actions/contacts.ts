"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContactInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  designation?: string;
  status?: string;
  contactType?: string;
  isPrimary?: boolean;
  notes?: string;
  customerId?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function generateContactCode(): Promise<string> {
  const count = await prisma.contact.count();
  const next = count + 1;
  return `CON-${String(next).padStart(4, "0")}`;
}

// ─── READ ────────────────────────────────────────────────────────────────────

export async function getContactsAction(params?: {
  search?: string;
  status?: string;
  contactType?: string;
  customerId?: string;
}) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const { search = "", status = "", contactType = "", customerId = "" } = params || {};

    // Role-based visibility: Finance/Management contacts are restricted.
    // Only Admin and SalesManager roles may view them.
    // SalesExecutive and other roles are excluded from these sensitive contacts.
    const restrictedTypes = ["Finance", "Management"];
    const canViewRestricted = ["Admin", "SalesManager", "SuperAdmin"].includes(user.role);

    const contacts = await prisma.contact.findMany({
      where: {
        deletedAt: null,
        ownerId: user.id,
        ...(status ? { status } : {}),
        ...(contactType ? { contactType } : {}),
        ...(customerId ? { customerId } : {}),
        // Apply role-based restriction on Finance/Management contacts
        ...(!canViewRestricted ? { contactType: { notIn: restrictedTypes } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
                { company: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        Task: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: contacts };
  } catch (error) {
    console.error("getContactsAction error:", error);
    return { success: false, message: "Failed to fetch contacts." };
  }
}

export async function getContactByIdAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const contact = await prisma.contact.findUnique({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, customerCode: true, city: true, status: true, accountType: true, industryType: true, phone: true, email: true } },
        Task: {
          include: { User: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
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
      },
    });

    if (!contact || contact.ownerId !== user.id) {
      return { success: false, message: "Contact not found." };
    }

    // Role-based visibility: block Finance/Management contacts for unauthorized roles
    const restrictedTypes = ["Finance", "Management"];
    const canViewRestricted = ["Admin", "SalesManager", "SuperAdmin"].includes(user.role);
    if (!canViewRestricted && restrictedTypes.includes(contact.contactType)) {
      return { success: false, message: "Unauthorized: You do not have permission to view this contact." };
    }

    return { success: true, data: contact };
  } catch (error) {
    console.error("getContactByIdAction error:", error);
    return { success: false, message: "Failed to fetch contact." };
  }
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createContactAction(input: ContactInput) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const contactCode = await generateContactCode();

    const contact = await prisma.contact.create({
      data: {
        id: nanoid(),
        contactCode,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        title: input.title ?? null,
        designation: input.designation ?? null,
        status: input.status ?? "Active",
        contactType: input.contactType ?? "Technical",
        isPrimary: input.isPrimary ?? false,
        notes: input.notes ?? null,
        customerId: input.customerId ?? null,
        ownerId: user.id,
        companyId: user.companyId ?? null,
      },
    });

    revalidatePath("/contacts");
    return { success: true, data: contact };
  } catch (error) {
    console.error("createContactAction error:", error);
    return { success: false, message: "Failed to create contact." };
  }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export async function updateContactAction(id: string, input: Partial<ContactInput>) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.contact.findUnique({ where: { id, deletedAt: null } });
    if (!existing || existing.ownerId !== user.id) {
      return { success: false, message: "Contact not found." };
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.company !== undefined && { company: input.company }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.designation !== undefined && { designation: input.designation }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.contactType !== undefined && { contactType: input.contactType }),
        ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.customerId !== undefined && { customerId: input.customerId }),
      },
    });

    revalidatePath("/contacts");
    return { success: true, data: updated };
  } catch (error) {
    console.error("updateContactAction error:", error);
    return { success: false, message: "Failed to update contact." };
  }
}

// ─── DELETE (Soft) ───────────────────────────────────────────────────────────

export async function deleteContactAction(id: string) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer" || user.role === "SalesExecutive") {
      return { success: false, message: "Unauthorized" };
    }

    const existing = await prisma.contact.findUnique({ where: { id, deletedAt: null } });
    if (!existing || existing.ownerId !== user.id) {
      return { success: false, message: "Contact not found." };
    }

    await prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });
    revalidatePath("/contacts");
    return { success: true };
  } catch (error) {
    console.error("deleteContactAction error:", error);
    return { success: false, message: "Failed to delete contact." };
  }
}
