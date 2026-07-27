const fs = require('fs');
const file = 'lib/canonical-navigation-config.ts';
let lines = fs.readFileSync(file, 'utf8').split('\\n');

let currentVariant = null;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // We check includes to avoid any trailing spaces issues
  if (line.includes('const V1_ITEMS: NavItem[] = [')) {
    lines[i] = line.replace('const V1_ITEMS', 'export const V1_ITEMS');
  } else if (line.includes('const V2_EXTRAS: NavItem[] = [')) {
    lines[i] = line.replace('const V2_EXTRAS', 'export const V2_EXTRAS');
    currentVariant = 2;
  } else if (line.includes('const V3_EXTRAS: NavItem[] = [')) {
    lines[i] = line.replace('const V3_EXTRAS', 'export const V3_EXTRAS');
    currentVariant = 3;
  } else if (line.includes('const V4_EXTRAS: NavItem[] = [')) {
    lines[i] = line.replace('const V4_EXTRAS', 'export const V4_EXTRAS');
    currentVariant = 4;
  } else if (line.includes('];')) {
    currentVariant = null;
  }

  // Add variantMin if we are inside a V2/V3/V4 array
  if (currentVariant && line.includes('{ key:') && !line.includes('variantMin:')) {
    const lastBrace = line.lastIndexOf('}');
    if (lastBrace !== -1) {
      lines[i] = line.substring(0, lastBrace) + `, variantMin: ${currentVariant} ` + line.substring(lastBrace);
    }
  }
}

fs.writeFileSync(file, lines.join('\\n'), 'utf8');
console.log('Fixed successfully');
