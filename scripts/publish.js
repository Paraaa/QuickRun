const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target || !['ovsx', 'vscode'].includes(target)) {
  console.error('Usage: node scripts/publish.js <ovsx|vscode>');
  process.exit(1);
}

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const originalName = pkg.name;
const originalDisplayName = pkg.displayName;

const config = {
  ovsx: {
    name: 'quickrun',
    displayName: 'Quick Run',
    cmd: 'ovsx publish -p $OVSX_TOKEN',
  },
  vscode: {
    name: 'quickrun-vscode-extension',
    displayName: 'Quick Run',
    cmd: 'vsce publish -p $VSCE_TOKEN',
  },
};

const { name, displayName, cmd } = config[target];

try {
  pkg.name = name;
  pkg.displayName = displayName;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Publishing as "${displayName}" (${name}) to ${target}...`);
  execSync(cmd, { stdio: 'inherit', shell: true });
} finally {
  pkg.name = originalName;
  pkg.displayName = originalDisplayName;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Restored to "${originalDisplayName}" (${originalName})`);
}
