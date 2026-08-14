import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import ExcelJS from "exceljs";

const CUSTOMER_HEADERS: Record<string, string> = {
  "customer name": "name",
  "gst number": "gstNumber",
  "contact person": "contactPerson",
  "mobile number": "mobile",
  "email id": "email",
  "address": "address",
  "state": "state",
  "payment terms": "paymentTerms",
  "credit days": "creditDays",
  "marketing executive": "marketingExecutive",
  "customer category": "customerCategory",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanMobile(mobile: string): string {
  return mobile.replace(/[^\d]/g, "");
}

function normalizeCustomerCategory(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase().replace(/\s+/g, "-");
  if (v === "80-20" || v === "80/20") return "80-20";
  if (v === "NON-80-20" || v === "NON-80/20" || v === "NON 80-20" || v.startsWith("NON")) return "NON-80-20";
  return null;
}

export async function GET() {
  const user = await verifyAuth();
  if (!user || user.role === "Customer") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Customer Master");

  const headers = Object.keys(CUSTOMER_HEADERS).map(
    (h) => h.replace(/\b\w/g, (c) => c.toUpperCase()).replace("Gst", "GST").replace("Id", "ID")
  );
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([
    "ABC Engineering Works",
    "33AABCU1234A1Z5",
    "Ramesh Kumar",
    "9876543210",
    "purchase@abcengg.com",
    "12/3 Industrial Estate, Chennai",
    "Tamil Nadu",
    "50% advance, balance before dispatch",
    30,
    "Shahnaz",
    "80-20",
  ]);
  sheet.columns.forEach((col) => { col.width = 26; });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="customer-master-template.xlsx"',
    },
  });
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
      const key = CUSTOMER_HEADERS[normalizeHeader(cell.value)];
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

    const baseCount = await prisma.customer.count();
    const errors: { row: number; message: string }[] = [];
    const created: { row: number; customerCode: string; name: string }[] = [];
    const preview: { row: number; name: string; customerCode: string; status: string; errors?: string[] }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const rowErrors: string[] = [];

      const name = String(row.name ?? "").trim();
      const gstNumber = String(row.gstNumber ?? "").trim().toUpperCase() || null;
      const contactPerson = String(row.contactPerson ?? "").trim() || null;
      const mobile = String(row.mobile ?? "").trim() || null;
      const email = String(row.email ?? "").trim() || null;
      const address = String(row.address ?? "").trim() || null;
      const state = String(row.state ?? "").trim() || null;
      const paymentTerms = String(row.paymentTerms ?? "").trim() || null;
      const creditDaysRaw = row.creditDays;
      const marketingExecutive = String(row.marketingExecutive ?? "").trim() || null;
      const customerCategoryRaw = String(row.customerCategory ?? "").trim() || null;

      if (!name) rowErrors.push("Customer Name is required");
      if (gstNumber && !/^[0-9A-Z]{15}$/.test(gstNumber)) rowErrors.push("GST Number must be 15 characters");
      if (email && !isValidEmail(email)) rowErrors.push("Email ID is invalid");

      let creditDays: number | null = null;
      if (creditDaysRaw !== undefined && creditDaysRaw !== null && String(creditDaysRaw).trim() !== "") {
        const parsed = parseInt(String(creditDaysRaw).trim(), 10);
        if (isNaN(parsed) || parsed < 0) {
          rowErrors.push("Credit Days must be a non-negative number");
        } else {
          creditDays = parsed;
        }
      }

      const customerCategory = normalizeCustomerCategory(customerCategoryRaw);

      let assignedUserId = user.id;
      if (marketingExecutive) {
        const exec = await prisma.user.findFirst({
          where: {
            isActive: true,
            OR: [
              { name: { equals: marketingExecutive } },
              { email: { equals: marketingExecutive } },
            ],
          },
          select: { id: true },
        });
        if (exec) assignedUserId = exec.id;
      }

      if (dryRun) {
        const customerCode = `CUS-${String(baseCount + i + 1).padStart(5, "0")}`;
        preview.push({
          row: rowNumber,
          name: name || "-",
          customerCode,
          status: rowErrors.length ? "Error" : "Valid",
          errors: rowErrors.length ? rowErrors : undefined,
        });
        continue;
      }

      if (rowErrors.length) {
        errors.push({ row: rowNumber, message: rowErrors.join("; ") });
        continue;
      }

      const existingGst = gstNumber
        ? await prisma.customer.findFirst({ where: { gstNumber, companyId: user.companyId ?? null } })
        : null;
      if (existingGst) {
        errors.push({ row: rowNumber, message: `Customer with GST ${gstNumber} already exists` });
        continue;
      }

      const customerCode = `CUS-${String(baseCount + created.length + errors.length + 1).padStart(5, "0")}`;

      try {
        const customer = await prisma.customer.create({
          data: {
            customerCode,
            name,
            email: email || null,
            phone: mobile ? cleanMobile(mobile) : null,
            city: null,
            state,
            gstNumber,
            billingAddress: address,
            shippingAddress: address,
            paymentTerms,
            creditTermsDays: creditDays ?? 30,
            customerCategory,
            assignedUserId,
            companyId: user.companyId ?? null,
          },
        });

        if (contactPerson) {
          await prisma.contact.create({
            data: {
              name: contactPerson,
              phone: mobile ? cleanMobile(mobile) : null,
              email: email || null,
              customerId: customer.id,
              ownerId: assignedUserId,
              isPrimary: true,
              contactType: "Other",
              companyId: user.companyId ?? null,
            },
          });
        }

        created.push({ row: rowNumber, customerCode, name });
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
    console.error("POST /api/customer-master/import error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
