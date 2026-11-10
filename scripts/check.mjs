import { readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
async function check(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.name === 'vendor') continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) await check(path);
    else if (/\.(js|mjs)$/.test(item.name)) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
await check(join(root, 'public'));
await check(join(root, 'scripts'));
console.log('Authored JavaScript syntax checks passed.');
