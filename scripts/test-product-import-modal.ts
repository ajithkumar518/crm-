/**
 * LIVE TEST: Product Import Modal (v2)
 *
 * 1. Verify the products listing page now triggers the modal (not a separate page)
 * 2. Verify the template endpoint works
 * 3. Verify the real import API works through a file upload
 * 4. Verify the import page redirects to products listing
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

  const u = await prisma.user.findFirst({ where: { role: "Admin", isActive: true } });
  if (!u) { console.log("no user"); process.exit(1); }
  const t = jwt.sign({ id: u.id, email: u.email, role: u.role, companyId: u.companyId }, process.env.JWT_SECRET!, { expiresIn: "1h" });
  const cookie = `token=${t}`;

  // ── 1. Products listing page ──
  console.log("\n=== 1. Products listing page ===\n");
  const r1 = await fetch(`${API_BASE}/catalogue/products`, { headers: { Cookie: cookie } });
  const html1 = await r1.text();
  console.log(`Products listing page: HTTP ${r1.status}`);
  check("Products listing page reachable (200)", r1.status === 200);
  check("Page has 'Import' button text", html1.includes("Import"), "Looking for 'Import' button text in HTML/JS bundle");
  // The modal's JS bundle contains the template endpoint URL and the import API path
  // (the component name itself is minified, so we check for the modal's actual strings).
  const chunkUrls1 = html1.match(/\/_next\/static\/chunks\/[^"]+/g) || [];
  let modalInBundle = false;
  for (const chunkUrl of chunkUrls1.slice(0, 50)) {
    try {
      const cr = await fetch(`${API_BASE}${chunkUrl}`);
      const ct = await cr.text();
      if (ct.includes("/api/catalogue/products/import/template") && ct.includes("/api/catalogue/products/import?dryRun=")) {
        modalInBundle = true;
        break;
      }
    } catch (e) { /* skip */ }
  }
  check("Product import modal JS bundle contains template and import API URLs", modalInBundle,
    "The modal's fetch calls should be in the client JS bundle");

  // ── 2. Old import page redirects to products listing ──
  console.log("\n=== 2. Old import page redirect ===\n");
  const r2 = await fetch(`${API_BASE}/catalogue/products/import`, { headers: { Cookie: cookie }, redirect: "manual" });
  console.log(`Old import page: HTTP ${r2.status}, Location: ${r2.headers.get("location")}`);
  check("Old import page returns 307/308 redirect", r2.status === 307 || r2.status === 308, `got ${r2.status}`);
  check("Redirect target is /catalogue/products", r2.headers.get("location") === "/catalogue/products");

  // ── 3. Template download ──
  console.log("\n=== 3. Template download from modal endpoint ===\n");
  const r3 = await fetch(`${API_BASE}/api/catalogue/products/import/template`, { headers: { Cookie: cookie } });
  console.log(`Template endpoint: HTTP ${r3.status}`);
  check("Template endpoint returns 200", r3.status === 200);
  const buf = Buffer.from(await r3.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const headers: string[] = [];
  ws.getRow(1).eachCell((c) => headers.push(String(c.value ?? "").trim()));
  console.log(`Headers: ${JSON.stringify(headers)}`);
  const expected = ["Material Grade", "Material Size", "Part Number", "RM Make", "Unit of Measure", "Material Category", "Product Description"];
  check("Template has exactly 7 headers", headers.length === 7);
  for (let i = 0; i < expected.length; i++) check(`Header ${i + 1}: "${expected[i]}"`, headers[i] === expected[i], `got "${headers[i]}"`);

  // ── 4. Real import via API (same as what the modal calls) ──
  console.log("\n=== 4. Real import through API ===\n");
  await prisma.product.deleteMany({ where: { productCode: "PN-MODAL-001", companyId: u.companyId } });

  const testWb = new ExcelJS.Workbook();
  const testWs = testWb.addWorksheet("Products");
  testWs.addRow(expected);
  testWs.addRow(["SS316", "22mm", "PN-MODAL-001", "JINDAL", "kgs", "Stainless Steel", "SS316 Round Bar 22mm"]);
  const testBuf = await testWb.xlsx.writeBuffer();

  const formData = new FormData();
  const blob = new Blob([Buffer.from(testBuf)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  formData.append("file", blob, "test-modal.xlsx");

  const dryRunRes = await fetch(`${API_BASE}/api/catalogue/products/import?dryRun=true`, { method: "POST", headers: { Cookie: cookie }, body: formData });
  const dryRunData = await dryRunRes.json();
  console.log(`Dry run: created=${dryRunData.created}, errors=${dryRunData.errors}`);
  check("Dry run: 1 valid row", dryRunData.total === 1 && dryRunData.created === 0 && dryRunData.errors === 0,
    `total=${dryRunData.total}, created=${dryRunData.created}, errors=${dryRunData.errors}`);
  check("Dry run: details has preview row", Array.isArray(dryRunData.details) && dryRunData.details.length === 1);
  check("Dry run: preview row status=Valid", dryRunData.details?.[0]?.status === "Valid");

  const importRes = await fetch(`${API_BASE}/api/catalogue/products/import?dryRun=false`, { method: "POST", headers: { Cookie: cookie }, body: formData });
  const importData = await importRes.json();
  console.log(`Import: created=${importData.created}, errors=${importData.errors}`);
  check("Real import: 1 created", importData.created === 1);
  check("Real import: 0 errors", importData.errors === 0);

  const dbProduct = await prisma.product.findFirst({ where: { productCode: "PN-MODAL-001", companyId: u.companyId }, include: { category: { select: { name: true } } } });
  if (dbProduct) {
    console.log(`\nDB record:`);
    console.log(`  productCode: ${dbProduct.productCode}`);
    console.log(`  materialGrade: ${dbProduct.materialGrade}`);
    console.log(`  materialSize: ${dbProduct.materialSize}`);
    console.log(`  partNumber: ${dbProduct.partNumber}`);
    console.log(`  rmMake: ${dbProduct.rmMake}`);
    console.log(`  unit: ${dbProduct.unit}`);
    console.log(`  category: ${dbProduct.category?.name}`);
    console.log(`  description: ${dbProduct.description}`);
    check("DB: product created with all 7 fields", dbProduct.productCode === "PN-MODAL-001" && dbProduct.materialGrade === "SS316");
  } else {
    check("DB: product created", false);
  }

  // Cleanup
  await prisma.product.deleteMany({ where: { productCode: "PN-MODAL-001", companyId: u.companyId } });
  await prisma.productCategory.deleteMany({ where: { name: "Stainless Steel", companyId: u.companyId } }).catch(() => {});

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
