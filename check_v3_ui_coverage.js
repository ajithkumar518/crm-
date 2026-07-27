const fs = require('fs');
const path = require('path');

const dirs = [
  "app/(dashboard)/samples/page.tsx",
  "app/(dashboard)/negotiations/page.tsx",
  "app/(dashboard)/documents/page.tsx",
  "app/(dashboard)/approvals/page.tsx",
  "app/(dashboard)/deals/page.tsx",
  "app/(dashboard)/decision-summary/page.tsx",
  "app/(dashboard)/settings/deal-stages/page.tsx",
  "app/(dashboard)/settings/approval-workflows/page.tsx"
];

for (const p of dirs) {
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8');
    if (!content.includes('<ModuleGate')) {
      console.log(`Missing ModuleGate in ${p}`);
    } else {
      console.log(`ModuleGate OK in ${p}`);
    }
  } else {
    console.log(`File not found: ${p}`);
  }
}
