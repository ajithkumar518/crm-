const fs = require('fs');
const file = 'lib/canonical-navigation-config.ts';
let content = fs.readFileSync(file, 'utf8');

function debugBlock(blockName) {
    let startStr = `export const ${blockName}: NavItem[] = [`;
    let startIdx = content.indexOf(startStr);
    console.log(`${blockName} startIdx:`, startIdx);
    
    if(startIdx !== -1) {
        let endIdx = content.indexOf('];', startIdx);
        console.log(`${blockName} endIdx:`, endIdx);
        
        let chunk = content.slice(startIdx, endIdx);
        console.log(`CHUNK LENGTH:`, chunk.length);
        console.log(`FIRST 100 CHARS:`, chunk.slice(0, 100));
    }
}

debugBlock('V2_EXTRAS');
debugBlock('V3_EXTRAS');
