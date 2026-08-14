import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import ExcelJS from "exceljs";

const PRODUCT_HEADERS: Record<string, string> = {
  "material grade": "materialGrade",
  "material size": "materialSize",
  "part number": "partNumber",
  "rm make": "rmMake",
  "uom": "uom",
  "unit of measure": "uom",
  "material category": "materialCategory",
  "product description": "productDescription",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeProductType(value?: string): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("black")) return "Black Bar";
  if (v.includes("bright")) return "Bright Bar";
  return null;
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer()) as any;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ success: false, message: "Excel file has no worksheets" }, { status: 400 });
    }

    const headerMap: Record<number, string> = {};
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const key = PRODUCT_HEADERS[normalizeHeader(cell.value)];
      if (key) headerMap[colNumber] = key;
    });

    if (Object.keys(headerMap).length === 0) {
      return NextResponse.json({ success: false, message: "Invalid template. Required headers not found." }, { status: 400 });
    }

    const rows: Record<string, any>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const key = headerMap[colNumber];
        if (key) record[key] = cell.value;
      });
      if (Object.keys(record).length > 0) rows.push(record);
    });

    const errors: { row: number; message: string }[] = [];
    const created: { row: number; productCode: string; name: string }[] = [];
    const preview: { row: number; productCode: string; name: string; status: string; errors?: string[] }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const rowErrors: string[] = [];

      const materialGrade = String(row.materialGrade ?? "").trim() || null;
      const materialSize = String(row.materialSize ?? "").trim() || null;
      const partNumber = String(row.partNumber ?? "").trim() || null;
      const rmMake = String(row.rmMake ?? "").trim() || null;
      const uom = String(row.uom ?? "").trim() || null;
      const materialCategory = String(row.materialCategory ?? "").trim() || null;
      const productDescription = String(row.productDescription ?? "").trim() || null;

      if (!materialGrade) rowErrors.push("Material Grade is required");
      if (!partNumber) rowErrors.push("Part Number is required");
      if (!materialCategory) rowErrors.push("Material Category is required");

      const baseName = productDescription || `${materialGrade || ""} ${materialSize || ""} ${partNumber || ""}`.trim();

      if (dryRun) {
        const productCode = (partNumber || `PRD-${String(i + 1).padStart(5, "0")}`).toUpperCase();
        preview.push({
          row: rowNumber,
          productCode,
          name: baseName || "-",
          status: rowErrors.length ? "Error" : "Valid",
          errors: rowErrors.length ? rowErrors : undefined,
        });
        continue;
      }

      if (rowErrors.length) {
        errors.push({ row: rowNumber, message: rowErrors.join("; ") });
        continue;
      }

      // Find or create product category for this company
      let categoryId: string | null = null;
      if (materialCategory) {
        const category = await prisma.productCategory.findFirst({
          where: { name: materialCategory, companyId: user.companyId ?? null },
        });
        if (category) {
          categoryId = category.id;
        } else {
          try {
            const newCategory = await prisma.productCategory.create({
              data: {
                name: materialCategory,
                companyId: user.companyId ?? null,
              },
            });
            categoryId = newCategory.id;
          } catch (err: any) {
            errors.push({ row: rowNumber, message: `Failed to create material category: ${err.message}` });
            continue;
          }
        }
      }

      const productCode = (partNumber || `PRD-${String(i + 1).padStart(5, "0")}`).toUpperCase();

      const existing = await prisma.product.findFirst({
        where: { productCode, companyId: user.companyId ?? null },
      });
      if (existing) {
        errors.push({ row: rowNumber, message: `Product with part number ${partNumber} already exists` });
        continue;
      }

      try {
        const product = await prisma.product.create({
          data: {
            productCode,
            name: baseName,
            categoryId,
            description: productDescription,
            unit: uom,
            materialGrade,
            materialSize,
            partNumber,
            rmMake,
            isActive: true,
            companyId: user.companyId ?? null,
          },
        });
        created.push({ row: rowNumber, productCode, name: product.name });
      } catch (err: any) {
        errors.push({ row: rowNumber, message: err.message || "Database error" });
      }
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      created: created.length,
      errors: errors.length,
      details: dryRun ? preview : errors,
      createdRows: dryRun ? [] : created,
    });
  } catch (error: any) {
    console.error("POST /api/catalogue/products/import error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
