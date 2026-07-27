const fs = require('fs');
const file = 'lib/canonical-navigation-config.ts';
let content = fs.readFileSync(file, 'utf8');

let startStr = `export const V2_EXTRAS: NavItem[] = [`;
let startIdx = content.indexOf(startStr);
let endIdx = content.indexOf('];', startIdx);
let chunk = content.slice(startIdx, endIdx);
let lines = chunk.split('\\n');
for(let i=0; i<lines.length; i++) {
    if(lines[i].includes('{ key:') && !lines[i].includes('variantMin:')) {
        console.log("MATCHED:", lines[i]);
    } else if (lines[i].includes('{ key:')) {
        console.log("ALREADY HAS VARIANTMIN:", lines[i]);
    }
}
