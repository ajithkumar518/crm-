const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function checkDir(dirPath) {
  let missing = [];
  walkDir(dirPath, function(filePath) {
    if (filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      const routeRegex = /export async function (GET|POST|PUT|DELETE)\(/g;
      let match;
      let hasExport = false;
      let hasEnforce = content.includes('enforceModuleGuard');
      
      while ((match = routeRegex.exec(content)) !== null) {
        hasExport = true;
        // Check if enforceModuleGuard is actually called within the function
        const funcStart = match.index;
        const funcText = content.substring(funcStart, funcStart + 500); // look ahead a bit
        if (!funcText.includes('enforceModuleGuard')) {
           missing.push(`${filePath} - ${match[1]}`);
        }
      }
    }
  });
  return missing;
}

const dirs = [
  'app/api/rfq',
  'app/api/visits',
  'app/api/catalogue'
];

let allMissing = [];
dirs.forEach(d => {
  if (fs.existsSync(d)) {
    const res = checkDir(d);
    allMissing = allMissing.concat(res);
  }
});

console.log("Missing enforceModuleGuard:");
allMissing.forEach(m => console.log(m));
