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

/**
 * Validate an Indian mobile number.
 * Accepts: 10 digits starting with 6-9, optionally prefixed with +91 or 91.
 * Returns the cleaned 10-digit number if valid, or null if invalid.
 */
function validateIndianMobile(raw: string): string | null {
  const cleaned = cleanMobile(raw);
  // Strip leading 91 if present (91 prefix for India)
  let digits = cleaned;
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  // Must be exactly 10 digits, starting with 6-9
  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}

/**
 * Validate an Indian GST number (15-character structured format).
 * Format: 2-digit state code + 10-char PAN (5 letters + 4 digits + 1 letter)
 *         + 1 entity digit + "Z" + 1 checksum alphanumeric.
 * Regex: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}Z[0-9A-Z]{1}$
 */
function isValidGst(gst: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}Z[0-9A-Z]{1}$/.test(gst);
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
      if (gstNumber && !isValidGst(gstNumber)) {
        rowErrors.push("GST Number must be valid 15-char Indian GST format (e.g. 33AABCU1234A1Z5)");
      }
      if (email && !isValidEmail(email)) rowErrors.push("Email ID is invalid");

      // Mobile validation: if provided, must be a valid Indian mobile number
      let validatedMobile: string | null = null;
      if (mobile) {
        validatedMobile = validateIndianMobile(mobile);
        if (!validatedMobile) {
          rowErrors.push("Mobile Number must be a valid 10-digit Indian mobile (starting with 6-9, optional +91 prefix)");
        }
      }

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

      // Duplicate detection: check GST, then email, then name+mobile
      const existingGst = gstNumber
        ? await prisma.customer.findFirst({ where: { gstNumber, companyId: user.companyId ?? null } })
        : null;
      if (existingGst) {
        errors.push({ row: rowNumber, message: `Customer with GST ${gstNumber} already exists` });
        continue;
      }

      // Email duplicate check (prevents unhandled DB unique constraint error)
      if (email) {
        const existingEmail = await prisma.customer.findFirst({
          where: { email, companyId: user.companyId ?? null },
        });
        if (existingEmail) {
          errors.push({ row: rowNumber, message: `Customer with email ${email} already exists` });
          continue;
        }
      }

      // Name + mobile duplicate check (fallback when GST is blank)
      if (!gstNumber && validatedMobile) {
        const existingNameMobile = await prisma.customer.findFirst({
          where: {
            name: { equals: name },
            phone: validatedMobile,
            companyId: user.companyId ?? null,
          },
        });
        if (existingNameMobile) {
          errors.push({ row: rowNumber, message: `Customer with name "${name}" and mobile ${validatedMobile} already exists` });
          continue;
        }
      }

      const customerCode = `CUS-${String(baseCount + created.length + errors.length + 1).padStart(5, "0")}`;

      try {
        const customer = await prisma.customer.create({
          data: {
            customerCode,
            name,
            email: email || null,
            phone: validatedMobile || null,
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
              phone: validatedMobile || null,
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
