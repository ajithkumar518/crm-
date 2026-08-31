import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { createFormattedWorkbook, writeWorkbookBuffer, EXCEL_CONTENT_TYPE } from "@/lib/excel-utils";
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

// GET /api/catalogue/products/bulk-export
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const guard = enforceModuleGuard(user, MODULE_KEYS.PRODUCT_CATALOGUE, "API app/api/catalogue/products/bulk-export/route.ts");
    if (guard) return guard;

    const url = new URL(request.url);
    const categoryId = url.searchParams.get("categoryId") || "";
    const isActive = url.searchParams.get("isActive");

    const where: any = { deletedAt: null };

    if (user.companyId) {
      where.companyId = user.companyId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    } else {
      where.isActive = true;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
        datasheets: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
        brochures: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Product Code",
      "Name",
      "Category",
      "Description",
      "Unit",
      "Base Price",
      "Product Type",
      "Min Order Quantity",
      "Status",
      "Datasheets",
      "Brochures",
    ];

    const rows = products.map((p) => [
      p.productCode,
      p.name,
      p.category?.name || "—",
      p.description || "—",
      p.unit || "—",
      Number(p.basePrice || 0),
      p.productType || "—",
      Number(p.minOrderQuantity || 0),
      p.isActive ? "Active" : "Inactive",
      p.datasheets?.map((d: any) => d.fileName).join("; ") || "—",
      p.brochures?.map((b: any) => b.fileName).join("; ") || "—",
    ]);

    const workbook = createFormattedWorkbook(
      "Products Export",
      headers,
      rows,
      [22, 28, 24, 40, 14, 16, 22, 20, 16, 32, 32]
    );

    const buffer = await writeWorkbookBuffer(workbook);

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": EXCEL_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="products-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/catalogue/products/bulk-export error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
