import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { createFormattedWorkbook, writeWorkbookBuffer, EXCEL_CONTENT_TYPE } from "@/lib/excel-utils";

const HEADERS = [
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

const EXAMPLE = [
  ["SS304", "12mm", "EXAMPLE-001", "SAIL", "kgs", "Stainless Steel",
   "EXAMPLE ROW — delete before uploading", "150.00", "7218", "100", "Black Bar"],
];

const COL_WIDTHS = [18, 14, 22, 16, 18, 22, 40, 16, 14, 22, 22];

/**
 * GET /api/catalogue/products/import/template
 *
 * Returns a downloadable .xlsx template with the exact 11 column headers the
 * product import parser expects, plus 1 example row (clearly marked as example
 * data to delete before uploading).
 */
export async function GET() {
  try {
    const user = await verifyAuth();
    if (!user || user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const workbook = createFormattedWorkbook("Products", HEADERS, EXAMPLE, COL_WIDTHS);

    // Instructions sheet with valid Product Type values
    const instructions = workbook.addWorksheet("Instructions");
    instructions.addRow(["Product Import - Valid Values"]);
    instructions.getRow(1).font = { bold: true, size: 12 };
    instructions.addRow([]);
    instructions.addRow(["Product Type (required):"]);
    instructions.getRow(3).font = { bold: true };
    instructions.addRow(["Black Bar", "Bright Bar", "Bright Ground Bar"]);
    instructions.addRow([]);
    instructions.addRow(["Other required columns:"]);
    instructions.getRow(6).font = { bold: true };
    instructions.addRow(["Material Grade, Part Number, Material Category"]);
    instructions.columns.forEach((col) => { col.width = 30; });

    const buffer = await writeWorkbookBuffer(workbook);

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": EXCEL_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="product-import-template.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/catalogue/products/import/template error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
