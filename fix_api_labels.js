const fs = require('fs');
const path = require('path');

const filesToFix = [
  "app/api/negotiations/[id]/route.ts",
  "app/api/negotiations/[id]/request-approval/route.ts",
  "app/api/negotiations/[id]/notes/route.ts",
  "app/api/negotiations/[id]/revisions/route.ts",
  "app/api/documents/companies/route.ts",
  "app/api/documents/[id]/route.ts",
  "app/api/documents/[id]/revision/route.ts",
  "app/api/documents/company/[customerId]/route.ts",
  "app/api/approvals/[id]/route.ts",
  "app/api/deals/route.ts"
];

for (const file of filesToFix) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const lines = content.split('\n');
  let currentMethod = null;

  for (let i = 0; i < lines.length; i++) {
    const methodMatch = lines[i].match(/export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\b/);
    if (methodMatch) {
      currentMethod = methodMatch[1];
    }

    if (lines[i].includes('enforceModuleGuard') && lines[i].includes('"C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service/')) {
      // replace the bad string with `"${currentMethod} /api/..."`
      const apiPathMatch = lines[i].match(/\/api\/(.+)"/);
      if (apiPathMatch && currentMethod) {
        const actualPath = `/api/${apiPathMatch[1]}`;
        const newStr = `"${currentMethod} ${actualPath}"`;
        lines[i] = lines[i].replace(/"C:\/Users\/Sandhiya\/Desktop\/SUKI_CRM2\/Crm_sales_Service\/\/[^"]+"/, newStr);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log(`Fixed ${file}`);
  }
}
