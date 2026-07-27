const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('app/(dashboard)');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // ASCII for backslash is 92, for n is 110
  const target = String.fromCharCode(92) + 'n';
  if (content.includes(target)) {
     let fixed = content.split(target).join('\\n');
     if (fixed !== content) {
         fs.writeFileSync(file, fixed, 'utf8');
         console.log('Fixed newlines in', file);
     }
  }
}
console.log('Newline fix 3 completed');
