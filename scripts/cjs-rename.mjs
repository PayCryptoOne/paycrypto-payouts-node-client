import { readdir, readFile, writeFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cjsDir = join(__dirname, '..', 'dist', 'cjs');

const files = await readdir(cjsDir);
const jsFiles = files.filter((f) => f.endsWith('.js'));
for (const f of jsFiles) {
  const path = join(cjsDir, f);
  let content = await readFile(path, 'utf8');
  content = content.replace(/require\(['"]\.\/([^'"]+)\.js['"]\)/g, "require('./$1.cjs')");
  const cjsPath = join(cjsDir, f.replace(/\.js$/, '.cjs'));
  await writeFile(cjsPath, content);
  await unlink(path);
}
