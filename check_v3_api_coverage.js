const fs = require('fs');
const path = require('path');

const dirs = [
  "app/api/samples",
  "app/api/negotiations",
  "app/api/documents",
  "app/api/approvals",
  "app/api/deals"
];

let missing = [];

function checkDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory ${dir} does not exist`);
    return;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      checkDir(fullPath);
    } else if (fullPath.endsWith('route.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        if (content.includes(`export async function ${method}`)) {
          // simple check: does the file import enforceModuleGuard?
          if (!content.includes('enforceModuleGuard')) {
            missing.push(`${fullPath} - ${method}`);
          } else {
             // check if there is an actual call inside the method
             // Not a perfect parser, but good enough for a rough estimate
             const methodRegex = new RegExp(`export async function ${method}[\\s\\S]*?enforceModuleGuard`);
             if (!methodRegex.test(content)) {
                // maybe it's not in this specific method
                missing.push(`${fullPath} - ${method} (imported but maybe missing in block)`);
             }
          }
        }
      }
    }
  }
}

for (const d of dirs) {
  checkDir(d);
}

if (missing.length > 0) {
  console.log("Missing enforceModuleGuard:");
  missing.forEach(m => console.log(m));
} else {
  console.log("All routes seem to have enforceModuleGuard.");
}
