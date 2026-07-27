const fs = require('fs');

const getTypesCode = `const getContactTypes = (isV2: boolean, isV3: boolean) => [
  ...(!isV2 ? [] : []),
  ...(isV2 && !isV3 ? ["Technical", "Purchase"] : []),
  ...(isV3 ? ["Technical", "Purchase", "Finance", "Management"] : [])
];`;

const files = [
  "app/(dashboard)/contacts/page.tsx",
  "app/(dashboard)/contacts/[id]/page.tsx",
  "app/(dashboard)/contacts/new/page.tsx"
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('getContactTypes')) {
    console.log(`Already fixed: ${file}`);
    continue;
  }
  
  content = content.replace('const CONTACT_TYPES = ["Technical", "Purchase", "Finance", "Management"];', getTypesCode);
  
  // Now replace usages of CONTACT_TYPES with getContactTypes(isV2, isV3)
  // We know isV2 and isV3 might already be defined in some of these files.
  // If not, we need to add them.
  content = content.replace(/CONTACT_TYPES\.map/g, 'getContactTypes(isV2, isV3).map');
  content = content.replace(/CONTACT_TYPES/g, 'getContactTypes(isV2, isV3)');
  
  // ensure isV2 and isV3 are available in the component body
  // They are usually defined as:
  // const isV2 = hasMod(MODULE_KEYS.RFQ);
  // We need to make sure isV3 is defined:
  // const isV3 = hasMod(MODULE_KEYS.SAMPLE_MANAGEMENT);
  
  if (!content.includes('const isV3')) {
    content = content.replace('const isV2 = hasMod(MODULE_KEYS.RFQ);', 'const isV2 = hasMod(MODULE_KEYS.RFQ);\n  const isV3 = hasMod(MODULE_KEYS.SAMPLE_MANAGEMENT);');
  }

  // in /new/page.tsx, isV2 might not be defined. Let's check.
  if (file.includes('new/page.tsx') && !content.includes('const isV2 =')) {
      content = content.replace('const hasMod = useHasModule();', 'const hasMod = useHasModule();\n  const isV2 = hasMod(MODULE_KEYS.RFQ);\n  const isV3 = hasMod(MODULE_KEYS.SAMPLE_MANAGEMENT);');
      // also ensure useHasModule is imported
      if (!content.includes('useHasModule')) {
          content = `import { useHasModule } from "@/components/ModuleGate";\nimport { MODULE_KEYS } from "@/lib/config/moduleVariantMap";\n` + content;
      }
  }

  // in /[id]/page.tsx, isV2 might not be defined. Let's check.
  if (file.includes('[id]/page.tsx') && !content.includes('const isV2 =')) {
      content = content.replace('const hasMod = useHasModule();', 'const hasMod = useHasModule();\n  const isV2 = hasMod(MODULE_KEYS.RFQ);\n  const isV3 = hasMod(MODULE_KEYS.SAMPLE_MANAGEMENT);');
      if (!content.includes('const hasMod = useHasModule();')) {
           // insert inside ContactsDetailPage
           content = content.replace('const { user } = useAuth();', 'const { user } = useAuth();\n  const hasMod = useHasModule();\n  const isV2 = hasMod(MODULE_KEYS.RFQ);\n  const isV3 = hasMod(MODULE_KEYS.SAMPLE_MANAGEMENT);');
      }
      if (!content.includes('useHasModule')) {
          content = `import { useHasModule } from "@/components/ModuleGate";\nimport { MODULE_KEYS } from "@/lib/config/moduleVariantMap";\n` + content;
      }
  }

  fs.writeFileSync(file, content);
  console.log(`Fixed CONTACT_TYPES in ${file}`);
}
