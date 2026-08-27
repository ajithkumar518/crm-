import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import ExcelJS from "exceljs";
import { createFormattedWorkbook, writeWorkbookBuffer, EXCEL_CONTENT_TYPE } from "@/lib/excel-utils";

// Canonical valid values (matching the UI dropdowns)
const VALID_STATUSES = ["Prospect", "ActiveCustomer", "Renewed", "Churned"];
const VALID_LEAD_SOURCES = [
  "Website",
  "IndiaMART",
  "Justdial",
  "TradeIndia",
  "WhatsApp",
  "Door-to-Door Marketing",
  "Direct Visit",
  "Telephonic Conversation",
  "Email",
];
const VALID_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];
const VALID_CATEGORIES = ["80-20", "NON-80-20"];

// Header synonyms. Key is normalized header text (lowercase, single spaces).
// Customer Code is intentionally absent — it is auto-generated.
const CUSTOMER_HEADERS: Record<string, string> = {
  "customer name": "name",
  "name": "name",
  "email id": "email",
  "email": "email",
  "mobile number": "mobile",
  "mobile": "mobile",
  "phone": "mobile",
  "city": "city",
  "location": "location",
  "status": "status",
  "lead source": "leadSource",
  "assign to executive": "marketingExecutive",
  "marketing executive": "marketingExecutive",
  "assigned executive": "marketingExecutive",
  "gst number": "gstNumber",
  "gstin": "gstNumber",
  "customer category": "customerCategory",
  "state": "state",
  "industry type": "industryType",
  "payment terms": "paymentTerms",
  "credit days": "creditDays",
  "billing address": "billingAddress",
  "address": "billingAddress",
  "shipping address": "shippingAddress",
  "contact person": "contactPerson",
  "contact mobile": "contactMobile",
  "contact email": "contactEmail",
};

const TEMPLATE_HEADERS = [
  "Customer Name*",
  "Email ID",
  "Mobile Number",
  "City",
  "Location",
  "Status",
  "Lead Source*",
  "Assign to Executive",
  "GST Number",
  "Customer Category",
  "State*",
  "Industry Type",
  "Payment Terms",
  "Credit Days",
  "Billing Address",
  "Shipping Address",
  "Contact Person",
  "Contact Mobile",
  "Contact Email",
];

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanMobile(mobile: string): string {
  return mobile.replace(/[^\d]/g, "");
}

function validateIndianMobile(raw: string): string | null {
  const cleaned = cleanMobile(raw);
  let digits = cleaned;
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}

function isValidGst(gst: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}Z[0-9A-Z]{1}$/.test(gst);
}

function normalizeCustomerCategory(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase().replace(/\s+/g, "-");
  if (v === "80-20" || v === "80/20") return "80-20";
  if (v === "NON-80-20" || v === "NON-80/20" || v === "NON-80-20-" || v.startsWith("NON")) return "NON-80-20";
  return null;
}

function normalizeStatus(value?: string | null): string {
  if (!value) return "Prospect";
  const v = value.trim();
  const match = VALID_STATUSES.find((s) => s.toLowerCase() === v.toLowerCase());
  return match || "Prospect";
}

function normalizeLeadSource(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  const match = VALID_LEAD_SOURCES.find((s) => s.toLowerCase() === v.toLowerCase());
  return match || null;
}

function normalizeState(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  const match = VALID_STATES.find((s) => s.toLowerCase() === v.toLowerCase());
  return match || null;
}

const TEMPLATE_EXAMPLE = [
  "ABC Engineering Works",       // Customer Name
  "purchase@abcengg.com",        // Email ID
  "9876543210",                  // Mobile Number
  "Chennai",                     // City
  "No. 45, Anna Salai, T. Nagar",// Location
  "Prospect",                    // Status
  "IndiaMART",                   // Lead Source
  "Shahnaz",                     // Assign to Executive
  "33AABCU1234A1Z5",             // GST Number
  "80-20",                       // Customer Category
  "Tamil Nadu",                  // State
  "Manufacturing",               // Industry Type
  "50% advance, balance before dispatch", // Payment Terms
  30,                            // Credit Days
  "12/3 Industrial Estate, Chennai", // Billing Address
  "12/3 Industrial Estate, Chennai", // Shipping Address
  "Ramesh Kumar",                // Contact Person
  "9876543210",                  // Contact Mobile
  "ramesh@abcengg.com",          // Contact Email
];

const TEMPLATE_COL_WIDTHS = [24, 24, 18, 18, 30, 16, 20, 22, 22, 20, 18, 20, 30, 16, 34, 34, 24, 18, 30];

export async function GET() {
  const user = await verifyAuth();
  if (!user || user.role === "Customer") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const workbook = createFormattedWorkbook(
    "Customer Master",
    TEMPLATE_HEADERS,
    [TEMPLATE_EXAMPLE],
    TEMPLATE_COL_WIDTHS
  );

  // ─── Instructions sheet ────────────────────────────────────────────────
  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRow(["Customer Master Import - Instructions"]);
  instructions.getRow(1).font = { bold: true, size: 12 };
  instructions.addRow([]);
  instructions.addRow(["Required Fields (rows missing these will be rejected):"]);
  instructions.getRow(3).font = { bold: true };
  instructions.addRow(["Customer Name*, Lead Source*, State*"]);
  instructions.addRow([]);
  instructions.addRow(["Valid Status values:"]);
  instructions.getRow(6).font = { bold: true };
  instructions.addRow([VALID_STATUSES.join(", ")]);
  instructions.addRow([]);
  instructions.addRow(["Valid Lead Source values:"]);
  instructions.getRow(9).font = { bold: true };
  instructions.addRow([VALID_LEAD_SOURCES.join(", ")]);
  instructions.addRow([]);
  instructions.addRow(["Valid Customer Category values:"]);
  instructions.getRow(12).font = { bold: true };
  instructions.addRow([VALID_CATEGORIES.join(", ")]);
  instructions.addRow([]);
  instructions.addRow(["Valid State values:"]);
  instructions.getRow(15).font = { bold: true };
  instructions.addRow([VALID_STATES.join(", ")]);
  instructions.columns.forEach((col) => { col.width = 80; });

  const buffer = await writeWorkbookBuffer(workbook);
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": EXCEL_CONTENT_TYPE,
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
      const email = String(row.email ?? "").trim() || null;
      const mobile = String(row.mobile ?? "").trim() || null;
      const city = String(row.city ?? "").trim() || null;
      const location = String(row.location ?? "").trim() || null;
      const statusRaw = String(row.status ?? "").trim() || null;
      const leadSourceRaw = String(row.leadSource ?? "").trim() || null;
      const marketingExecutive = String(row.marketingExecutive ?? "").trim() || null;
      const gstNumber = String(row.gstNumber ?? "").trim().toUpperCase() || null;
      const customerCategoryRaw = String(row.customerCategory ?? "").trim() || null;
      const stateRaw = String(row.state ?? "").trim() || null;
      const industryType = String(row.industryType ?? "").trim() || null;
      const paymentTerms = String(row.paymentTerms ?? "").trim() || null;
      const creditDaysRaw = row.creditDays;
      const billingAddress = String(row.billingAddress ?? "").trim() || null;
      const shippingAddress = String(row.shippingAddress ?? "").trim() || null;
      const contactPerson = String(row.contactPerson ?? "").trim() || null;
      const contactMobile = String(row.contactMobile ?? "").trim() || null;
      const contactEmail = String(row.contactEmail ?? "").trim() || null;

      // ─── Required field validation ──────────────────────────────────────
      if (!name) rowErrors.push("Customer Name is required");
      if (!leadSourceRaw) rowErrors.push("Lead Source is required");
      if (!stateRaw) rowErrors.push("State is required (required for GST tax type determination)");

      // ─── Normalization & format validation ──────────────────────────────
      const status = normalizeStatus(statusRaw);
      const leadSource = normalizeLeadSource(leadSourceRaw);
      const state = normalizeState(stateRaw);
      const customerCategory = normalizeCustomerCategory(customerCategoryRaw);

      if (leadSourceRaw && !leadSource) {
        rowErrors.push(`Lead Source "${leadSourceRaw}" is not valid. Valid: ${VALID_LEAD_SOURCES.join(", ")}`);
      }
      if (stateRaw && !state) {
        rowErrors.push(`State "${stateRaw}" is not valid. Use the exact state name from the valid values.`);
      }
      if (gstNumber && !isValidGst(gstNumber)) {
        rowErrors.push("GST Number must be valid 15-char Indian GST format (e.g. 33AABCU1234A1Z5)");
      }
      if (email && !isValidEmail(email)) rowErrors.push("Email ID is invalid");

      // Mobile validation
      let validatedMobile: string | null = null;
      if (mobile) {
        validatedMobile = validateIndianMobile(mobile);
        if (!validatedMobile) {
          rowErrors.push("Mobile Number must be a valid 10-digit Indian mobile (starting with 6-9, optional +91 prefix)");
        }
      }

      // Contact mobile validation
      let validatedContactMobile: string | null = null;
      if (contactMobile) {
        validatedContactMobile = validateIndianMobile(contactMobile);
        if (!validatedContactMobile) {
          rowErrors.push("Contact Mobile must be a valid 10-digit Indian mobile");
        }
      }

      // Credit days
      let creditDays: number | null = null;
      if (creditDaysRaw !== undefined && creditDaysRaw !== null && String(creditDaysRaw).trim() !== "") {
        const parsed = parseInt(String(creditDaysRaw).trim(), 10);
        if (isNaN(parsed) || parsed < 0) {
          rowErrors.push("Credit Days must be a non-negative number");
        } else {
          creditDays = parsed;
        }
      }

      // Marketing executive / assign to executive
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
        if (exec) {
          assignedUserId = exec.id;
        }
        // Do NOT error if not found — fallback to current user as before
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

      // ─── Duplicate detection ────────────────────────────────────────────
      const existingGst = gstNumber
        ? await prisma.customer.findFirst({ where: { gstNumber, companyId: user.companyId ?? null } })
        : null;
      if (existingGst) {
        errors.push({ row: rowNumber, message: `Customer with GST ${gstNumber} already exists` });
        continue;
      }

      if (email) {
        const existingEmail = await prisma.customer.findFirst({
          where: { email, companyId: user.companyId ?? null },
        });
        if (existingEmail) {
          errors.push({ row: rowNumber, message: `Customer with email ${email} already exists` });
          continue;
        }
      }

      if (!gstNumber && validatedMobile) {
        const existingNameMobile = await prisma.customer.findFirst({
          where: { name: { equals: name }, phone: validatedMobile, companyId: user.companyId ?? null },
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
            email,
            phone: validatedMobile,
            city,
            location,
            state,
            status,
            assignedUserId,
            leadSource,
            companyId: user.companyId ?? null,
            // V2 fields
            gstNumber,
            accountType: "Prospect",
            industryType,
            billingAddress,
            shippingAddress,
            paymentTerms,
            creditTermsDays: creditDays ?? 30,
            customerCategory,
          },
        });

        if (contactPerson || validatedContactMobile || contactEmail) {
          await prisma.contact.create({
            data: {
              name: contactPerson || "Primary Contact",
              phone: validatedContactMobile || null,
              email: contactEmail || null,
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
