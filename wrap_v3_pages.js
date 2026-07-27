const fs = require('fs');

const files = [
  "app/(dashboard)/samples/page.tsx",
  "app/(dashboard)/negotiations/page.tsx",
  "app/(dashboard)/documents/page.tsx",
  "app/(dashboard)/approvals/page.tsx",
  "app/(dashboard)/deals/page.tsx",
  "app/(dashboard)/decision-summary/page.tsx"
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('<ModuleGate')) {
    console.log(`Already wrapped: ${file}`);
    continue;
  }

  // Find the default export component
  const exportMatch = content.match(/export default function\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/);
  if (exportMatch) {
    const fnName = exportMatch[1];
    
    // We can rename the current export to InternalComponent and create a new default export
    let newContent = content;
    
    // Check if ModuleGate is imported
    if (!newContent.includes('import { ModuleGate }')) {
      // add import at top
      newContent = `import { ModuleGate } from "@/components/ModuleGate";\n` + newContent;
    }
    
    // replace export default function with function
    newContent = newContent.replace(`export default function ${fnName}`, `function ${fnName}`);
    
    // append wrapper at the end
    newContent += `\n\nexport default function ${fnName}Wrapper(props: any) {\n  return (\n    <ModuleGate variantMin={3}>\n      <${fnName} {...props} />\n    </ModuleGate>\n  );\n}\n`;
    
    fs.writeFileSync(file, newContent);
    console.log(`Wrapped ${file}`);
  } else {
    console.log(`Could not find export default function in ${file}`);
  }
}
