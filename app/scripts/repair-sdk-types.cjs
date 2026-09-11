// SDK 57 packages contain declaration imports pointing at unpublished src paths.
// Repair declaration imports only; never touch runtime JS or weaken app type checks.
const fs = require('node:fs');
const path = require('node:path');
const modules = path.resolve(__dirname, '../node_modules');
let repaired = 0;
if (!JSON.parse(fs.readFileSync(path.join(modules, 'expo/package.json'), 'utf8')).version.startsWith('57.')) {
  console.log('SDK declaration repair is scoped to Expo 57; skipped.');
  process.exit(0);
}
function visit(dir, packageRoot) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { visit(file, packageRoot); continue; }
    if (!entry.name.endsWith('.d.ts')) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace(/(['"])([^'"\n]+)\1/g, (match, quote, specifier) => {
      let target;
      if (specifier.startsWith('.') && specifier.includes('src/')) {
        const resolved = path.resolve(path.dirname(file), specifier);
        if (resolved.startsWith(path.join(packageRoot, 'src') + path.sep))
          target = resolved.replace(path.join(packageRoot, 'src'), path.join(packageRoot, 'build'));
      } else {
        const parts = specifier.match(/^(expo(?:-[\w-]+)?)\/src\/(.+)$/);
        if (parts) target = path.join(modules, parts[1], 'build', parts[2]);
      }
      if (!target || !(fs.existsSync(target + '.d.ts') || fs.existsSync(path.join(target, 'index.d.ts')))) return match;
      let relative = path.relative(path.dirname(file), target).split(path.sep).join('/');
      if (!relative.startsWith('.')) relative = './' + relative;
      return quote + relative + quote;
    });
    if (before !== after) { fs.writeFileSync(file, after); repaired++; }
  }
}
for (const name of fs.readdirSync(modules)) {
  if (name !== 'expo' && !name.startsWith('expo-')) continue;
  const root = path.join(modules, name);
  const build = path.join(root, 'build');
  if (fs.existsSync(build)) visit(build, root);
}
console.log(`Repaired SDK declaration imports in ${repaired} files.`);
