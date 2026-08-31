import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth();
  if (!user)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  const guard = enforceModuleGuard(
    user,
    MODULE_KEYS.DOCUMENTS,
    "POST /api/documents/[id]/revision",
  );
  if (guard) return guard;
  if (user.role === "Customer")
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 403 },
    );

  const { id } = await params;

  // Find the existing document
  const existing = await prisma.cRMDocument.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
  });
  if (!existing)
    return NextResponse.json(
      { success: false, message: "Document not found" },
      { status: 404 },
    );

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json(
      { success: false, message: "No file provided" },
      { status: 400 },
    );

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { success: false, message: "File size exceeds 20MB limit" },
      { status: 400 },
    );
  }

  const ALLOWED_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".csv",
  ];
  const ALLOWED_MIME_PREFIXES = [
    "image/",
    "application/pdf",
    "text/",
    "application/vnd.openxmlformats",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ];
  const fileExt = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
    return NextResponse.json(
      { success: false, message: "File type not allowed" },
      { status: 400 },
    );
  }
  if (
    file.type &&
    !ALLOWED_MIME_PREFIXES.some((p) => file.type!.startsWith(p))
  ) {
    return NextResponse.json(
      { success: false, message: "File type not allowed" },
      { status: 400 },
    );
  }

  // Resolve root document ID (if existing is already a revision, use its parent; otherwise use existing.id)
  const rootId = existing.parentDocumentId ?? existing.id;

  // Find the highest revision number for this document family
  const allRevisions = await prisma.cRMDocument.findMany({
    where: {
      OR: [{ id: rootId }, { parentDocumentId: rootId }],
      deletedAt: null,
    },
    select: { revisionNumber: true },
  });
  const maxRevision = allRevisions.reduce(
    (max, r) => Math.max(max, r.revisionNumber),
    0,
  );
  const newRevisionNumber = maxRevision + 1;

  // Save file
  const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  const fileName = `${Date.now()}-${randomUUID().split("-")[0]}${fileExt}`;
  const filePath = path.join(uploadDir, fileName);
  const fileUrl = `/uploads/documents/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));

  // Generate document code
  const year = new Date().getFullYear();
  const lastDoc = await prisma.cRMDocument.findFirst({
    where: {
      companyId: user.companyId,
      documentCode: { startsWith: `DOC-${year}-` },
    },
    orderBy: { createdAt: "desc" },
    select: { documentCode: true },
  });
  const nextNum = lastDoc?.documentCode
    ? parseInt(lastDoc.documentCode.split("-")[2] ?? "0") + 1
    : 1;
  const documentCode = `DOC-${year}-${String(nextNum).padStart(5, "0")}`;

  // Create new revision and mark all previous as non-current in a transaction
  const newRevision = await prisma.$transaction(async (tx) => {
    // Mark all existing revisions as non-current
    await tx.cRMDocument.updateMany({
      where: {
        OR: [{ id: rootId }, { parentDocumentId: rootId }],
        deletedAt: null,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    // Create the new revision
    return tx.cRMDocument.create({
      data: {
        documentCode,
        name: existing.name,
        documentType: existing.documentType,
        entityType: existing.entityType,
        entityId: existing.entityId,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        description: existing.description,
        tags: existing.tags,
        uploadedById: user.id,
        customerId: existing.customerId,
        companyId: user.companyId,
        parentDocumentId: rootId,
        revisionNumber: newRevisionNumber,
        isCurrent: true,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        Customer: { select: { id: true, name: true, customerCode: true } },
      },
    });
  });

  return NextResponse.json(
    { success: true, data: newRevision },
    { status: 201 },
  );
}
