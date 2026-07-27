const fs = require('fs');
const path = require('path');

const searchDirs = [
  'app/(dashboard)/dashboard',
  'app/(dashboard)/leads',
  'app/(dashboard)/customer-master',
  'app/(dashboard)/contacts',
  'app/(dashboard)/activities',
  'app/(dashboard)/sales-pipeline',
  'app/(dashboard)/quotations',
  'app/(dashboard)/tasks',
  'app/(dashboard)/follow-up',
  'components'
];

const keywords = ['Negotiation', 'Deal', 'Purchase Order', ' PO ', 'RFQ', 'Sample', 'Competitor', 'Territory', 'Target', 'Forecast'];
const excludeFileRegex = /node_modules|\.next|api/;

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

let allFiles = [];
for (const dir of searchDirs) {
  allFiles = allFiles.concat(walk(dir));
}

let found = {};

for (const file of allFiles) {
  if (excludeFileRegex.test(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const kw of keywords) {
      if (line.includes(kw)) {
        // Simple filter to avoid some obvious noise like imports or variable names if they don't look like labels
        if (!found[file]) found[file] = [];
        found[file].push({ line: i + 1, content: line.trim(), kw });
      }
    }
  }
}

for (const file in found) {
  console.log(`\n--- ${file} ---`);
  for (const match of found[file]) {
    console.log(`L${match.line} (${match.kw}): ${match.content}`);
  }
}
