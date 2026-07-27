const fs = require('fs');
const path = require('path');

const fileContent = fs.readFileSync('lib/canonical-navigation-config.ts', 'utf8');

const v1Match = fileContent.match(/export const V1_ITEMS.*?\[(.*?)\];/s);
if (!v1Match) {
  console.log("Could not find V1_ITEMS");
  process.exit(1);
}

const v1Str = v1Match[1];
const hrefRegex = /href:\s*'([^']+)'/g;

let match;
while ((match = hrefRegex.exec(v1Str)) !== null) {
  let urlPath = match[1].split('?')[0]; // remove query params
  if (urlPath === '/dashboard') urlPath = '/'; // Dashboard is often the root, wait let's check
  let pagePath = path.join('app/(dashboard)', urlPath, 'page.tsx');
  let pagePath2 = path.join('app/(dashboard)', urlPath, 'page.js');
  let pagePath3 = path.join('app', urlPath, 'page.tsx');
  let pagePath4 = path.join('app', urlPath, 'page.js');
  if (!fs.existsSync(pagePath) && !fs.existsSync(pagePath2) && !fs.existsSync(pagePath3) && !fs.existsSync(pagePath4)) {
    console.log("MISSING ROUTE:", match[1]);
  } else {
    // console.log("OK:", match[1]);
  }
}
console.log("Done checking V1 routes");
