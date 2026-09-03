import { config } from "dotenv";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
config();
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({ where: { role: "Admin", isActive: true } });
  if (!u) { console.log("no user"); process.exit(1); }
  const t = jwt.sign({ id: u.id, email: u.email, role: u.role, companyId: u.companyId }, process.env.JWT_SECRET!, { expiresIn: "1h" });

  // Fetch the products listing page
  const r = await fetch(`http://localhost:3000/catalogue/products`, { headers: { Cookie: `token=${t}` } });
  const html = await r.text();
  console.log(`Page status: ${r.status}, length: ${html.length}`);

  // Check if the URL appears in the page source (including script chunks)
  const hasUrl = html.includes("/catalogue/products/import");
  console.log(`/catalogue/products/import in page source: ${hasUrl}`);

  // Check for the Bulk Import title
  const hasBulkImport = html.includes("Bulk Import");
  console.log(`"Bulk Import" in page source: ${hasBulkImport}`);

  // Check for the Upload icon (lucide-react upload path in SVG)
  const hasUploadIcon = html.includes("upload") || html.includes("Upload");
  console.log(`"upload/Upload" in page source: ${hasUploadIcon}`);

  // Find all JS chunk URLs referenced in the page
  const chunkUrls = html.match(/\/_next\/static\/chunks\/[^"]+/g) || [];
  console.log(`\nFound ${chunkUrls.length} JS chunks referenced in page`);

  // Fetch the first few chunks and check for the import URL
  // The layout chunk should contain the router.push call
  const layoutChunks = chunkUrls.filter((c) => c.includes("layout") || c.includes("products"));
  console.log(`Layout/products chunks: ${layoutChunks.length}`);

  // Check all chunks for the URL (limit to first 20 to avoid timeout)
  let foundInChunk = false;
  for (const chunkUrl of chunkUrls.slice(0, 30)) {
    try {
      const cr = await fetch(`http://localhost:3000${chunkUrl}`);
      const ct = await cr.text();
      if (ct.includes("/catalogue/products/import")) {
        console.log(`Found /catalogue/products/import in chunk: ${chunkUrl}`);
        foundInChunk = true;
        break;
      }
    } catch (e) {
      // skip
    }
  }

  if (foundInChunk) {
    console.log("\nPASS: /catalogue/products/import found in client JS bundle");
  } else {
    console.log("\nFAIL: /catalogue/products/import NOT found in any checked JS chunk");
    // The URL might be in a chunk we didn't check. Let's also check the RSC payload
    const rscMatch = html.match(/"\/catalogue\/products\/import"/);
    console.log(`URL in RSC payload: ${!!rscMatch}`);
  }

  await prisma.$disconnect();
  process.exit(foundInChunk ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
