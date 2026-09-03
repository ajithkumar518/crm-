import * as ExcelJS from "exceljs";

const BLUE = "FF2563EB";
const BLUE_DARK = "FF1E40AF";
const WHITE = "FFFFFFFF";

export const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ExcelCellValue = string | number | boolean | null | undefined;

export function createFormattedWorkbook(
  sheetName: string,
  headers: string[],
  rows: ExcelCellValue[][],
  columnWidths?: number[]
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: BLUE_DARK } } };
  });

  rows.forEach((row) => {
    const r = sheet.addRow(row);
    r.eachCell((cell) => {
      cell.alignment = { vertical: "middle" };
    });
  });

  for (let i = 0; i < headers.length; i++) {
    sheet.getColumn(i + 1).width = columnWidths?.[i] ?? 18;
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  return workbook;
}

export async function writeWorkbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer() as any);
}

export async function createFormattedWorkbookBuffer(
  sheetName: string,
  headers: string[],
  rows: ExcelCellValue[][],
  columnWidths?: number[]
): Promise<Buffer> {
  const wb = createFormattedWorkbook(sheetName, headers, rows, columnWidths);
  return writeWorkbookBuffer(wb);
}
