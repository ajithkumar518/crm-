/**
 * LIVE TEST: Product Import UI fixes
 *
 * 1. Verify the products listing page now has an "Import" button linking to /catalogue/products/import
 * 2. Verify the template download endpoint returns a valid .xlsx file with correct 7 headers
 * 3. Download the template, fill in a real test row, re-upload through the real import path,
 *    and confirm it's accepted without header-mismatch errors
 * 4. Verify the import page has a "Download Template" button
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import { writeFileSync } from "fs";
config();
const prisma = new PrismaClient();

const API_BASE = "http://localhost:3000";

async function main() {
  let pass = 0, fail = 0;
  const check = (label: string, condition: boolean, detail?: string) => {
    const status = condition ? "PASS" : "FAIL";
    if (condition) pass++; else fail++;
    console.log(`[${status}] ${label}${detail ? " — " + detail : ""}`);
  };

  // ── Get auth token ──
  const company = await prisma.company.findFirst();
  const adminUser = await prisma.user.findFirst({
    where: { role: "Admin", isActive: true, companyId: company?.id },
    select: { id: true, email: true, companyId: true },
  });
  if (!adminUser) { console.log("No admin user"); process.exit(1); }
  const JWT_SECRET = process.env.JWT_SECRET!;
  const token = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "Admin", companyId: adminUser.companyId }, JWT_SECRET, { expiresIn: "1h" });
  const cookie = `token=${token}`;
  console.log(`Auth: admin=${adminUser.email}, companyId=${adminUser.companyId}`);

  // ── 1. Verify "Import" button on products listing page ──
  console.log("\n=== 1. Verify 'Import' button on products listing page ===\n");

  const productsPageRes = await fetch(`${API_BASE}/catalogue/products`, {
    method: "GET",
    headers: { Cookie: cookie },
  });
  const productsPageHtml = await productsPageRes.text();
  console.log(`Products listing page: HTTP ${productsPageRes.status}`);
  check("Products listing page reachable (200)", productsPageRes.status === 200);

  // The Import button links to /catalogue/products/import via router.push() which
  // is a client-side call — it won't appear in SSR HTML but will be in the JS bundle.
  // We verify the button title is in the SSR HTML (confirming it renders) and the
  // URL is in the JS bundle (confirming the navigation target).
  check("Products page has 'Bulk Import' button (title in SSR HTML)", productsPageHtml.includes("Bulk Import"),
    "The Import button title should be in the rendered HTML");

  // Verify the URL is in one of the JS chunks (client-side router.push)
  const chunkUrls = productsPageHtml.match(/\/_next\/static\/chunks\/[^"]+/g) || [];
  let urlInBundle = false;
  for (const chunkUrl of chunkUrls.slice(0, 40)) {
    try {
      const cr = await fetch(`${API_BASE}${chunkUrl}`);
      const ct = await cr.text();
      if (ct.includes("/catalogue/products/import")) { urlInBundle = true; break; }
    } catch (e) { /* skip */ }
  }
  check("Products page JS bundle has /catalogue/products/import URL", urlInBundle,
    "The router.push() call should be in the client JS bundle");

  // ── 2. Verify import page has "Download Template" button ──
  console.log("\n=== 2. Verify 'Download Template' button on import page ===\n");

  const importPageRes = await fetch(`${API_BASE}/catalogue/products/import`, {
    method: "GET",
    headers: { Cookie: cookie },
  });
  const importPageHtml = await importPageRes.text();
  console.log(`Import page: HTTP ${importPageRes.status}`);
  check("Import page reachable (200)", importPageRes.status === 200);
  check("Import page has 'Download Template' button", importPageHtml.includes("Download Template"),
    "The Download Template button should be on the import page");
  // Note: window.open() is a client-side call — it won't appear in SSR HTML.
  // The button's presence + the template endpoint working (tested below) is sufficient.

  // ── 3. Download the template ──
  console.log("\n=== 3. Download template from endpoint ===\n");

  const templateRes = await fetch(`${API_BASE}/api/catalogue/products/import/template`, {
    method: "GET",
    headers: { Cookie: cookie },
  });
  console.log(`Template endpoint: HTTP ${templateRes.status}`);
  console.log(`Content-Type: ${templateRes.headers.get("content-type")}`);
  console.log(`Content-Disposition: ${templateRes.headers.get("content-disposition")}`);

  check("Template endpoint returns 200", templateRes.status === 200);
  check("Template Content-Type is xlsx", templateRes.headers.get("content-type") === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  check("Template has attachment filename", (templateRes.headers.get("content-disposition") || "").includes("attachment"));
  check("Template filename is product-import-template.xlsx", (templateRes.headers.get("content-disposition") || "").includes("product-import-template.xlsx"));

  const templateBuffer = Buffer.from(await templateRes.arrayBuffer());
  console.log(`Template file size: ${templateBuffer.length} bytes`);
  check("Template file is non-empty (>1000 bytes)", templateBuffer.length > 1000);

  // Save template for inspection
  const templatePath = "C:\\Users\\ajithkumar\\Downloads\\product-import-template-DOWNLOADED.xlsx";
  writeFileSync(templatePath, templateBuffer);
  console.log(`Template saved to: ${templatePath}`);

  // ── 4. Open the downloaded template and verify headers ──
  console.log("\n=== 4. Verify template headers ===\n");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  const worksheet = workbook.worksheets[0];
  check("Template has a worksheet", !!worksheet);

  const headerRow = worksheet.getRow(1);
  const actualHeaders: string[] = [];
  headerRow.eachCell((cell) => {
    actualHeaders.push(String(cell.value ?? "").trim());
  });

  console.log(`Template headers: ${JSON.stringify(actualHeaders)}`);

  const expectedHeaders = [
    "Material Grade",
    "Material Size",
    "Part Number",
    "RM Make",
    "Unit of Measure",
    "Material Category",
    "Product Description",
  ];

  check("Template has exactly 7 headers", actualHeaders.length === 7, `got ${actualHeaders.length}`);
  for (let i = 0; i < expectedHeaders.length; i++) {
    check(`Template header ${i + 1}: "${expectedHeaders[i]}"`, actualHeaders[i] === expectedHeaders[i],
      `got "${actualHeaders[i]}"`);
  }

  // Check example row
  const exampleRow = worksheet.getRow(2);
  const exampleValues: string[] = [];
  exampleRow.eachCell((cell) => {
    exampleValues.push(String(cell.value ?? "").trim());
  });
  console.log(`Example row: ${JSON.stringify(exampleValues)}`);
  check("Template has an example row (row 2)", exampleValues.length >= 7);
  check("Example row is marked as EXAMPLE", exampleValues.some((v) => v.includes("EXAMPLE") || v.includes("delete")),
    "Example row should be clearly marked for deletion");

  // ── 5. Fill in a real test row in the downloaded template and re-upload ──
  console.log("\n=== 5. Re-upload downloaded template with a filled-in test row ===\n");

  // Remove the example row and add a real test row
  worksheet.spliceRows(2, 1); // remove example row
  worksheet.addRow([
    "SS304",
    "15mm",
    "PN-TPL-TEST-001",
    "SAIL",
    "kgs",
    "Stainless Steel",
    "SS304 Round Bar 15mm (from template)",
  ]);

  const filledBuffer = await workbook.xlsx.writeBuffer();
  const filledPath = "C:\\Users\\ajithkumar\\Downloads\\product-import-template-FILLED.xlsx";
  writeFileSync(filledPath, Buffer.from(filledBuffer));
  console.log(`Filled template saved to: ${filledPath}`);

  // Clean up any existing test product
  await prisma.product.deleteMany({
    where: { productCode: "PN-TPL-TEST-001", companyId: adminUser.companyId },
  });

  // Upload through the real import path (dryRun=false)
  const formData = new FormData();
  const filledBlob = new Blob([Buffer.from(filledBuffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  formData.append("file", filledBlob, "product-import-template-FILLED.xlsx");

  const importRes = await fetch(`${API_BASE}/api/catalogue/products/import?dryRun=false`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: formData,
  });
  const importData = await importRes.json();
  console.log(`Re-upload result: HTTP ${importRes.status}`);
  console.log(`Response: ${JSON.stringify(importData, null, 2)}`);

  check("Re-upload: API returns 200", importRes.status === 200);
  check("Re-upload: success=true", importData.success === true);
  check("Re-upload: created=1 (the filled-in row)", importData.created === 1, `got created=${importData.created}`);
  check("Re-upload: errors=0 (no header mismatch)", importData.errors === 0, `got errors=${importData.errors}`);
  check("Re-upload: no 'Invalid template' error", !JSON.stringify(importData).includes("Invalid template"),
    "Headers must match what the parser expects");

  // ── 6. Verify the DB record ──
  console.log("\n=== 6. Verify DB record from template re-upload ===\n");

  const dbProduct = await prisma.product.findFirst({
    where: { productCode: "PN-TPL-TEST-001", companyId: adminUser.companyId },
    include: { category: { select: { name: true } } },
  });

  if (dbProduct) {
    console.log(`DB record found:`);
    console.log(`  productCode: ${dbProduct.productCode}`);
    console.log(`  materialGrade: ${dbProduct.materialGrade}`);
    console.log(`  materialSize: ${dbProduct.materialSize}`);
    console.log(`  partNumber: ${dbProduct.partNumber}`);
    console.log(`  rmMake: ${dbProduct.rmMake}`);
    console.log(`  unit: ${dbProduct.unit}`);
    console.log(`  category: ${dbProduct.category?.name}`);
    console.log(`  description: ${dbProduct.description}`);

    check("DB: productCode=PN-TPL-TEST-001", dbProduct.productCode === "PN-TPL-TEST-001");
    check("DB: materialGrade=SS304", dbProduct.materialGrade === "SS304");
    check("DB: materialSize=15mm", dbProduct.materialSize === "15mm");
    check("DB: partNumber=PN-TPL-TEST-001", dbProduct.partNumber === "PN-TPL-TEST-001");
    check("DB: rmMake=SAIL", dbProduct.rmMake === "SAIL");
    check("DB: unit=kgs", dbProduct.unit === "kgs");
    check("DB: category=Stainless Steel", dbProduct.category?.name === "Stainless Steel");
    check("DB: description correct", dbProduct.description === "SS304 Round Bar 15mm (from template)");
  } else {
    check("DB: product created from template upload", false, "Product not found in DB");
  }

  // ── Cleanup ──
  console.log("\n=== Cleanup ===\n");
  await prisma.product.deleteMany({
    where: { productCode: "PN-TPL-TEST-001", companyId: adminUser.companyId },
  });
  await prisma.productCategory.deleteMany({
    where: { name: "Stainless Steel", companyId: adminUser.companyId },
  }).catch(() => {});
  console.log("Cleaned up test product and category");

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
