const fs = require('fs');
const path = require('path');

const mappings = [
  { file: 'app/(dashboard)/negotiations/page.tsx', prop: 'module={MODULE_KEYS.NEGOTIATION}' },
  { file: 'app/(dashboard)/documents/page.tsx', prop: 'module={MODULE_KEYS.DOCUMENTS}' },
  { file: 'app/(dashboard)/approvals/page.tsx', prop: 'module={MODULE_KEYS.APPROVAL_CENTER}' },
  { file: 'app/(dashboard)/competitors/page.tsx', prop: 'module={MODULE_KEYS.COMPETITORS}' },
  { file: 'app/(dashboard)/key-accounts/page.tsx', prop: 'module={MODULE_KEYS.KEY_ACCOUNTS}' },
  { file: 'app/(dashboard)/territories/page.tsx', prop: 'module={MODULE_KEYS.TERRITORIES}' },
  { file: 'app/(dashboard)/targets/page.tsx', prop: 'module={MODULE_KEYS.TARGETS}' },
  { file: 'app/(dashboard)/forecast/page.tsx', prop: 'module={MODULE_KEYS.FORECAST}' },
  { file: 'app/(dashboard)/catalogue/page.tsx', prop: 'module={MODULE_KEYS.PRODUCT_CATALOGUE}' },
  { file: 'app/(dashboard)/settings/pipeline-stages/page.tsx', prop: 'variantMin={2}' },
  { file: 'app/(dashboard)/settings/notification-rules/page.tsx', prop: 'variantMin={2}' },
  { file: 'app/(dashboard)/settings/whatsapp-templates/page.tsx', prop: 'variantMin={2}' },
  { file: 'app/(dashboard)/settings/product-categories/page.tsx', prop: 'variantMin={2}' },
  { file: 'app/(dashboard)/settings/approval-matrix/page.tsx', prop: 'module={MODULE_KEYS.APPROVAL_CENTER}' },
  { file: 'app/(dashboard)/settings/loss-reason-master/page.tsx', prop: 'variantMin={3}' },
  { file: 'app/(dashboard)/settings/custom-fields/page.tsx', prop: 'variantMin={3}' },
  { file: 'app/(dashboard)/settings/competitor-master/page.tsx', prop: 'module={MODULE_KEYS.COMPETITORS}' },
  { file: 'app/(dashboard)/settings/territories/page.tsx', prop: 'module={MODULE_KEYS.TERRITORIES}' }
];

for (const { file, prop } of mappings) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Missing file: ${file}`);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');

  if (content.includes('<ModuleGate')) {
    console.log(`Already wrapped: ${file}`);
    continue;
  }

  // 1. Add Imports
  const importModuleGate = `import { ModuleGate } from "@/components/ModuleGate";`;
  const importModuleKeys = `import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";`;
  
  let importsToAdd = importModuleGate;
  if (prop.includes('MODULE_KEYS') && !content.includes('MODULE_KEYS')) {
    importsToAdd += `\\n${importModuleKeys}`;
  }

  // Insert imports after the last import statement
  const importMatches = [...content.matchAll(/^import .*$/gm)];
  if (importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    const insertPos = lastImport.index + lastImport[0].length;
    content = content.slice(0, insertPos) + '\\n' + importsToAdd + content.slice(insertPos);
  } else {
    content = importsToAdd + '\\n\\n' + content;
  }

  // VERY SIMPLE WRAPPING
  // Find "export default function "
  const defaultExportRegex = /export default function\s+\w+\s*\([^)]*\)\s*\{/g;
  let match;
  let wrapped = false;
  
  while ((match = defaultExportRegex.exec(content)) !== null) {
    const funcBodyStart = match.index + match[0].length;
    
    // Find the LAST "return (" in the file that corresponds to this default export
    // We'll just look for the FIRST return after the export.
    const returnIndex = content.indexOf('return (', funcBodyStart);
    if (returnIndex !== -1) {
       // Replace `return (` with `return (\n    <ModuleGate ...>\n      <>`
       content = content.slice(0, returnIndex) + `return (\\n    <ModuleGate ${prop}>\\n      <>` + content.slice(returnIndex + 8);
       
       // Replace the last `);` in the file with `</>\n    </ModuleGate>\n  );`
       const lastIndex = content.lastIndexOf(');');
       if (lastIndex !== -1) {
         content = content.slice(0, lastIndex) + `</>\\n    </ModuleGate>\\n  );` + content.slice(lastIndex + 2);
         wrapped = true;
       }
    } else {
       // Look for "return <"
       const returnTagIndex = content.indexOf('return <', funcBodyStart);
       if (returnTagIndex !== -1) {
           content = content.slice(0, returnTagIndex) + `return (\\n    <ModuleGate ${prop}>\\n      <>\\n        <` + content.slice(returnTagIndex + 8);
           // Find the last `}` or `;`
           const lastIndex = content.lastIndexOf(';');
           if (lastIndex !== -1 && lastIndex > returnTagIndex) {
              content = content.slice(0, lastIndex) + `\\n      </>\\n    </ModuleGate>\\n  );` + content.slice(lastIndex + 1);
              wrapped = true;
           }
       }
    }
    if (wrapped) break;
  }

  if (wrapped) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Successfully wrapped ${file}`);
  } else {
    console.error(`FAILED to wrap ${file}`);
  }
}
