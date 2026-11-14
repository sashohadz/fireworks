// Writes smaller WebP copies of the store's product images (480 and 800 px wide) next to each JPEG, for srcset.
// The JPEGs are 1200 px wide and a phone shows them at about 380 px, so a phone downloads a fraction of the bytes.
// The JPEGs stay as they are: the product feeds, the mock API and Firework's product import use them.
//
// Usage: npm run gen:webp [-- --force]
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { WEBP_WIDTHS, webpVariantPath } from '../../src/lib/catalog';

const { values: args } = parseArgs({ options: { force: { type: 'boolean', default: false } } });
const PUBLIC = path.join(process.cwd(), 'public');
const ROOT = path.join(PUBLIC, 'images');

async function jpegs(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jpegs(full)));
    else if (entry.name.endsWith('.jpg')) out.push(full);
  }
  return out;
}

let written = 0;
let skipped = 0;
let bytesIn = 0;
let bytesOut = 0;
for (const file of await jpegs(ROOT)) {
  const publicPath = `/${path.relative(PUBLIC, file).split(path.sep).join('/')}`;
  const { width = 0 } = await sharp(file).metadata();
  bytesIn += (await fs.stat(file)).size;
  for (const w of WEBP_WIDTHS) {
    if (w >= width) continue;
    const target = path.join(PUBLIC, webpVariantPath(publicPath, w));
    if (!args.force && (await fs.stat(target).catch(() => null))) {
      skipped++;
      continue;
    }
    await sharp(file).resize({ width: w }).webp({ quality: 74, effort: 6 }).toFile(target);
    bytesOut += (await fs.stat(target)).size;
    written++;
  }
}
console.log(`WebP: ${written} written, ${skipped} already there. JPEG total ${Math.round(bytesIn / 1024)} KB; new WebP ${Math.round(bytesOut / 1024)} KB.`);
