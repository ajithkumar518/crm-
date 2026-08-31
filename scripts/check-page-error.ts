import { config } from "dotenv";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
config();
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({ where: { role: "Admin", isActive: true } });
  if (!u) { console.log("no user"); process.exit(1); }
  const t = jwt.sign({ id: u.id, email: u.email, role: u.role, companyId: u.companyId }, process.env.JWT_SECRET!, { expiresIn: "1h" });

  for (const path of ["/catalogue/products", "/catalogue/products/import"]) {
    const r = await fetch(`http://localhost:3000${path}`, { headers: { Cookie: `token=${t}` } });
    const text = await r.text();
    console.log(`\n=== ${path} → HTTP ${r.status} ===`);
    // Extract error message from Next.js error page
    const errorMatch = text.match(/"message":"([^"]+)"/);
    if (errorMatch) {
      console.log(`Error: ${errorMatch[1]}`);
    }
    // Look for compile error
    const compileMatch = text.match(/Failed to compile[\s\S]{0,500}/);
    if (compileMatch) {
      console.log(`Compile error: ${compileMatch[0].substring(0, 500)}`);
    }
    // Print a snippet
    const snippet = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").substring(0, 800);
    console.log(`Snippet: ${snippet}`);
  }

  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
