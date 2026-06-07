const fs = require('fs');
const path = require('path');
const pkgPath = path.join(__dirname, '..', 'node_modules', '@kabelsalat', 'web', 'package.json');
if (!fs.existsSync(pkgPath)) process.exit(0);
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
if (!pkg.exports) {
  pkg.exports = {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Patched @kabelsalat/web: added exports field');
}
