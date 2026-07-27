const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function fixGuard(dirPath) {
  walkDir(dirPath, function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('if (!guard.success) return guard.response;')) {
        content = content.replace(/if \(!guard\.success\) return guard\.response;/g, 'if (guard) return guard;');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${filePath}`);
      }
    }
  });
}

['app'].forEach(d => fixGuard(d));
