/**
 * libsodium-wrappers-sumo 0.7.x ships a broken ESM entry that tries to
 * import ./libsodium-sumo.mjs, which doesn't exist in the package.
 * This script removes the broken "import" export condition so Node.js
 * falls back to the working CJS build.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(
  __dirname,
  "../node_modules/libsodium-wrappers-sumo/package.json"
);

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

let changed = false;

if (pkg.module) {
  delete pkg.module;
  changed = true;
}

if (pkg.exports?.["."]?.import) {
  delete pkg.exports["."].import;
  changed = true;
}

if (changed) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("✓ Fixed libsodium-wrappers-sumo: removed broken ESM export");
} else {
  console.log("✓ libsodium-wrappers-sumo already patched");
}
