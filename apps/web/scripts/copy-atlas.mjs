// Copies the three.js atlas prototype (body/) into public/atlas so Next.js serves it at /atlas.
// body/ stays the single source; public/atlas is generated and ignored by git.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const body = join(web, '..', '..', 'body');
const out = join(web, 'public', 'atlas');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(body, 'index.html'), join(out, 'index.html'));
cpSync(join(body, 'models'), join(out, 'models'), { recursive: true });
console.log('atlas copied to public/atlas');
