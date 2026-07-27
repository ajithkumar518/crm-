const fs = require('fs');
const path = require('path');

const mappings = [
  { file: 'app/(dashboard)/deals/page.tsx', prop: 'module={MODULE_KEYS.DEALS}' },
  { file: 'app/(dashboard)/samples/page.tsx', prop: 'module={MODULE_KEYS.SAMPLE_MANAGEMENT}' },
  { file: 'app/(dashboard)/negotiations/page.tsx', prop: 'module={MODULE_KEYS.NEGOTIATION}' },
  { file: 'app/(dashboard)/documents/page.tsx', prop: 'module={MODULE_KEYS.DOCUMENTS}' },
  { file: 'app/(dashboard)/approvals/page.tsx', prop: 'module={MODULE_KEYS.APPROVAL_CENTER}' },
  { file: 'app/(dashboard)/purchase-orders/page.tsx', prop: 'module={MODULE_KEYS.PURCHASE_ORDERS}' },
  { file: 'app/(dashboard)/competitors/page.tsx', prop: 'module={MODULE_KEYS.COMPETITORS}' },
  { file: 'app/(dashboard)/key-accounts/page.tsx', prop: 'module={MODULE_KEYS.KEY_ACCOUNTS}' },
  { file: 'app/(dashboard)/territories/page.tsx', prop: 'module={MODULE_KEYS.TERRITORIES}' },
  { file: 'app/(dashboard)/targets/page.tsx', prop: 'module={MODULE_KEYS.TARGETS}' },
  { file: 'app/(dashboard)/forecast/page.tsx', prop: 'module={MODULE_KEYS.FORECAST}' },
  { file: 'app/(dashboard)/rfq/page.tsx', prop: 'module={MODULE_KEYS.RFQ}' },
  { file: 'app/(dashboard)/visits/page.tsx', prop: 'module={MODULE_KEYS.CUSTOMER_VISITS}' },
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

  // Find "export default function XXX() {"
  const defaultExportRegex = /export default function\s+\w+\s*\([^)]*\)\s*\{/g;
  let match;
  let wrapped = false;
  
  while ((match = defaultExportRegex.exec(content)) !== null) {
    const funcBodyStart = match.index + match[0].length;
    
    // Find the first "return" after this
    const returnIndex = content.indexOf('return', funcBodyStart);
    if (returnIndex !== -1 && returnIndex < funcBodyStart + 500) {
      
      const textAfterReturn = content.slice(returnIndex + 6).trimLeft();
      
      if (textAfterReturn.startsWith('(')) {
        // Return with parenthesis
        const parenStart = returnIndex + 6 + content.slice(returnIndex + 6).indexOf('(');
        let depth = 0;
        let endIndex = -1;
        for (let i = parenStart; i < content.length; i++) {
          if (content[i] === '(') depth++;
          if (content[i] === ')') {
            depth--;
            if (depth === 0) {
              endIndex = i;
              break;
            }
          }
        }
        
        if (endIndex !== -1) {
          const innerReturn = content.slice(parenStart + 1, endIndex); 
          const newReturn = `return (\\n    <ModuleGate ${prop}>\\n      <>\\n${innerReturn}\\n      </>\\n    </ModuleGate>\\n  )`;
          content = content.slice(0, returnIndex) + newReturn + content.slice(endIndex + 1);
          wrapped = true;
        }
      } else if (textAfterReturn.startsWith('<')) {
        // Return without parenthesis but directly starts with JSX tag e.g. return <Component />;
        const semicolonIndex = textAfterReturn.indexOf(';');
        if (semicolonIndex !== -1) {
          const innerReturn = textAfterReturn.slice(0, semicolonIndex);
          const newReturn = `return (\\n    <ModuleGate ${prop}>\\n      <>\\n        ${innerReturn}\\n      </>\\n    </ModuleGate>\\n  );`;
          content = content.slice(0, returnIndex) + newReturn + content.slice(returnIndex + 6 + content.slice(returnIndex + 6).indexOf('<') + semicolonIndex + 1);
          wrapped = true;
        }
      }
    }
    if (wrapped) break; // Only wrap the main export default
  }

  if (wrapped) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Successfully wrapped ${file}`);
  } else {
    console.error(`FAILED to wrap ${file} - could not parse return statement reliably.`);
  }
}
