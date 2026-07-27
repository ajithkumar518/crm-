const fs = require('fs');

const files = [
  "app/(dashboard)/accounts/page.tsx",
  "app/(dashboard)/activities/page.tsx",
  "app/(dashboard)/contacts/page.tsx",
  "app/(dashboard)/deals/page.tsx",
  "app/(dashboard)/follow-up/page.tsx",
  "app/(dashboard)/leads/page.tsx",
  "app/(dashboard)/rfq/[id]/page.tsx",
  "app/(dashboard)/sales-pipeline/pipeline-list/page.tsx",
  "app/(dashboard)/tasks/page.tsx"
];

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('import { useHasModule, MODULE_KEYS } from "@/lib/modules";')) {
    content = content.replace(
      'import { useHasModule, MODULE_KEYS } from "@/lib/modules";',
      'import { useHasModule } from "@/components/ModuleGate";\nimport { MODULE_KEYS } from "@/lib/config/moduleVariantMap";'
    );
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed imports in ${file}`);
  }
}
