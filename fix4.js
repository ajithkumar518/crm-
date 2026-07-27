const fs = require('fs');
const file = 'lib/canonical-navigation-config.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const V1_ITEMS/g, 'export const V1_ITEMS');
content = content.replace(/const V2_EXTRAS/g, 'export const V2_EXTRAS');
content = content.replace(/const V3_EXTRAS/g, 'export const V3_EXTRAS');
content = content.replace(/const V4_EXTRAS/g, 'export const V4_EXTRAS');
content = content.replace(/export export const/g, 'export const');

function fixBlock(blockName, minVal) {
    let startStr = `export const ${blockName}: NavItem[] = [`;
    let startIdx = content.indexOf(startStr);
    if(startIdx === -1) {
        console.log("Could not find", startStr);
        return;
    }
    let endIdx = content.indexOf('];', startIdx);
    
    let chunk = content.slice(startIdx, endIdx);
    let lines = chunk.split('\\n');
    for(let i=0; i<lines.length; i++) {
        if(lines[i].includes('{ key:') && !lines[i].includes('variantMin:')) {
            let idx = lines[i].lastIndexOf('}');
            lines[i] = lines[i].substring(0, idx) + `, variantMin: ${minVal} ` + lines[i].substring(idx);
            console.log(`Fixed ${blockName} line:`, lines[i].trim());
        }
    }
    content = content.slice(0, startIdx) + lines.join('\\n') + content.slice(endIdx);
}

fixBlock('V2_EXTRAS', 2);
fixBlock('V3_EXTRAS', 3);
fixBlock('V4_EXTRAS', 4);

fs.writeFileSync(file, content);
console.log('Done!');
