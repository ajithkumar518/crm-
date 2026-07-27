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

  // Avoid double wrapping
  if (content.includes('<ModuleGate')) {
    console.log(`Already wrapped: ${file}`);
    continue;
  }

  // Inject imports
  const importsToInject = [
    `import { ModuleGate } from "@/components/ModuleGate";`,
  ];
  if (prop.includes('MODULE_KEYS')) {
    importsToInject.push(`import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";`);
  }

  // Find the last import
  const lastImportIndex = content.lastIndexOf('import ');
  if (lastImportIndex !== -1) {
    const endOfLastImport = content.indexOf('\\n', lastImportIndex);
    content = content.slice(0, endOfLastImport) + '\\n' + importsToInject.join('\\n') + '\\n' + content.slice(endOfLastImport);
  } else {
    content = importsToInject.join('\\n') + '\\n\\n' + content;
  }

  // Find export default function
  const match = content.match(/export default function ([^({]+)/);
  if (!match) {
    console.warn(`Could not find export default function in ${file}`);
    continue;
  }

  // Find the last return statement inside the default export
  // It's safer to replace the return of the default function
  const lines = content.split('\\n');
  let exportDefaultStarted = false;
  let braceDepth = 0;
  let returnLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('export default function')) {
      exportDefaultStarted = true;
    }
    
    if (exportDefaultStarted) {
      // Very naive approach: find the outermost return inside the default function
      // A better way: just replace the entire function's return
      if (line.trim().startsWith('return (')) {
        returnLineIndex = i;
        break; // Assume the first return is the main one if we have a simple component
      } else if (line.trim().startsWith('return <')) {
        returnLineIndex = i;
        break;
      }
    }
  }

  if (returnLineIndex !== -1) {
    const line = lines[returnLineIndex];
    if (line.trim().startsWith('return (')) {
      lines[returnLineIndex] = line.replace('return (', `return (\\n    <ModuleGate ${prop}>`);
      // Find matching closing parenthesis
      // We will just append </ModuleGate> before the last `);`
      for (let j = lines.length - 1; j > returnLineIndex; j--) {
        if (lines[j].trim().includes(');')) {
          lines[j] = lines[j].replace(');', '  </ModuleGate>\\n  );');
          break;
        }
      }
    } else if (line.trim().startsWith('return <')) {
      lines[returnLineIndex] = line.replace('return <', `return (\\n    <ModuleGate ${prop}>\\n      <`);
      // It's a single line return or a multi-line tag without parens
      // Let's just find the last line that matches `}` or something, or just put it at the very end
      for (let j = lines.length - 1; j >= returnLineIndex; j--) {
        if (lines[j].trim() === '}' || lines[j].trim().endsWith(';')) {
           if (lines[j].trim().endsWith(';')) {
              lines[j] = lines[j].replace(';', '\\n    </ModuleGate>\\n  );');
           }
           break;
        }
      }
    }
    
    fs.writeFileSync(fullPath, lines.join('\\n'), 'utf8');
    console.log(`Wrapped ${file}`);
  } else {
    console.warn(`Could not find return statement in ${file}`);
  }
}
