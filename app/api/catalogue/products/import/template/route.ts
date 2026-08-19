import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import ExcelJS from "exceljs";

/**
 * GET /api/catalogue/products/import/template
 *
 * Returns a downloadable .xlsx template with the exact 7 column headers the
 * product import parser expects, plus 1 example row (clearly marked as example
 * data to delete before uploading).
 *
 * The header strings match the keys in PRODUCT_HEADERS in
 * app/api/catalogue/products/import/route.ts (after normalization — the parser
 * lowercases and collapses whitespace, so "Unit of Measure" and "UOM" both map
 * to the same field). We use the full spec names here.
 */
export async function GET() {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");

    // Header row — exact column names from the spec, matching what the import
    // parser's PRODUCT_HEADERS map recognizes (normalized to lowercase + collapsed
    // whitespace by the parser).
    const headers = [
      "Material Grade",
      "Material Size",
      "Part Number",
      "RM Make",
      "Unit of Measure",
      "Material Category",
      "Product Description",
      "Base Price",
      "HSN Code",
      "Min Order Quantity",
      "Product Type",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };

    // Example row — clearly marked so users delete it before uploading
    worksheet.addRow([
      "SS304",
      "12mm",
      "EXAMPLE-001",
      "SAIL",
      "kgs",
      "Stainless Steel",
      "EXAMPLE ROW — delete before uploading",
      "150.00",
      "7218",
      "100",
      "Black Bar",
    ]);

    // Auto-width columns
    worksheet.columns.forEach((col, i) => {
      const header = headers[i] ?? "";
      const exampleWidth = 40; // accommodate the example note
      col.width = Math.max(header.length + 4, exampleWidth);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="product-import-template.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/catalogue/products/import/template error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
