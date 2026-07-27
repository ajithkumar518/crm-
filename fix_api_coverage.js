const fs = require('fs');

const missing = [
  "app/api/rfq/[id]/requirement-report/route.ts",
  "app/api/visits/[id]/attachments/route.ts",
  "app/api/visits/auto-checkout/route.ts",
  "app/api/visits/auto-missed/route.ts",
  "app/api/catalogue/brochures/[id]/route.ts",
  "app/api/catalogue/brochures/route.ts",
  "app/api/catalogue/categories/[id]/route.ts",
  "app/api/catalogue/categories/route.ts",
  "app/api/catalogue/datasheets/[id]/route.ts",
  "app/api/catalogue/datasheets/route.ts",
  "app/api/catalogue/products/[id]/brochures/[brId]/route.ts",
  "app/api/catalogue/products/[id]/brochures/route.ts",
  "app/api/catalogue/products/[id]/costing-defaults/route.ts",
  "app/api/catalogue/products/[id]/datasheets/[dsId]/route.ts",
  "app/api/catalogue/products/[id]/datasheets/route.ts",
  "app/api/catalogue/products/[id]/route.ts",
  "app/api/catalogue/products/[id]/specs/[specId]/route.ts",
  "app/api/catalogue/products/[id]/specs/route.ts",
  "app/api/catalogue/products/bulk-export/route.ts",
  "app/api/catalogue/products/bulk-import/route.ts"
];

for (let file of missing) {
  let content = fs.readFileSync(file, 'utf8');
  
  // 1. Add imports if missing
  if (!content.includes('import { enforceModuleGuard }')) {
    content = content.replace(/(import .*;\n)+/m, match => {
      let extra = `import { enforceModuleGuard } from "@/lib/moduleGuard";\n`;
      if (!content.includes('MODULE_KEYS')) {
        extra += `import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";\n`;
      }
      return match + extra;
    });
  }

  let modKey = '';
  if (file.includes('/rfq/')) modKey = 'MODULE_KEYS.RFQ';
  else if (file.includes('/visits/')) modKey = 'MODULE_KEYS.CUSTOMER_VISITS';
  else if (file.includes('/catalogue/')) modKey = 'MODULE_KEYS.PRODUCT_CATALOGUE';

  // 2. Inject guard after `const user = await verifyAuth();` block
  // We look for `if (!user... return ...}` or similar.
  // A safe way is to find `verifyAuth()` and its subsequent if (!user) return block
  const verifyAuthRegex = /(const user = await verifyAuth\(\);[\s\S]*?if \(!user[\s\S]*?return .*?\n\s*\})/g;
  
  content = content.replace(verifyAuthRegex, (match) => {
    // Check if there is another role check right after (e.g. if (user.role === 'Customer'))
    // Actually, sometimes they are combined `if (!user || user.role === "Customer") { return ... }`
    return match + `\n\n    const guard = enforceModuleGuard(user, ${modKey}, "API ${file}");\n    if (!guard.success) return guard.response;`;
  });

  // What if there is `if (user.role !== "Admin"...) { return ... }` after the verifyAuth block?
  // Our regex will just insert before it, which is fine.

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}
