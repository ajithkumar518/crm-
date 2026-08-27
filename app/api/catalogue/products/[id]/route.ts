import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/catalogue/products/[id]
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const guard = enforceModuleGuard(user, MODULE_KEYS.PRODUCT_CATALOGUE, "API app/api/catalogue/products/[id]/route.ts");
    if (guard) return guard;

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        specifications: { orderBy: { displayOrder: "asc" } },
        datasheets: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
        brochures: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!product) {
      console.error(`Product detail 404: id=${id}, userCompanyId=${user.companyId}`);
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (product.companyId && product.companyId !== user.companyId) {
      console.error(`Product detail 403: id=${id}, productCompanyId=${product.companyId}, userCompanyId=${user.companyId}`);
      return NextResponse.json({ success: false, message: "Unauthorized: product does not belong to your company" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    console.error("GET /api/catalogue/products/[id] error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

const VALID_PRODUCT_TYPES = ["Black Bar", "Bright Bar", "Bright Ground Bar"];

// PUT /api/catalogue/products/[id]

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const guard = enforceModuleGuard(user, MODULE_KEYS.PRODUCT_CATALOGUE, "API app/api/catalogue/products/[id]/route.ts");
    if (guard) return guard;

    const body = await request.json();
    const { id } = await params;

    const productType = body.productType?.trim();
    if (!productType) {
      return NextResponse.json({ success: false, message: "Product Type is required" }, { status: 400 });
    }
    if (!VALID_PRODUCT_TYPES.includes(productType)) {
      return NextResponse.json({ success: false, message: `Product Type must be one of: ${VALID_PRODUCT_TYPES.join(", ")}` }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (existing.companyId && existing.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        categoryId: body.categoryId ?? null,
        description: body.description,
        unit: body.unit,
        basePrice: body.basePrice,
        isActive: body.isActive,
        productType,
        materialGrade: body.materialGrade?.trim() || null,
        materialSize: body.materialSize?.trim() || null,
        partNumber: body.partNumber?.trim() || null,
        rmMake: body.rmMake?.trim() || null,
        minOrderQuantity: body.minOrderQuantity ? parseFloat(body.minOrderQuantity) : null,
      },
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    console.error("PUT /api/catalogue/products/[id] error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/catalogue/products/[id]

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const guard = enforceModuleGuard(user, MODULE_KEYS.PRODUCT_CATALOGUE, "API app/api/catalogue/products/[id]/route.ts");
    if (guard) return guard;

    const { id } = await params;

    const existing = await prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (existing.companyId && existing.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    // Soft delete
    await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: user.id,
      },
    });

    return NextResponse.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/catalogue/products/[id] error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
