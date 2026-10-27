// Validates the catalog and video specs. Runs in CI and before any generation.
// Usage: npm run validate
import { imageExists, productImageDir, products } from '../src/lib/catalog';
import { loadSpecs } from './gen/lib/specs';

// Importing the catalog already parses it with zod and throws on invalid data.
const units = products.reduce((n, p) => n + p.units.length, 0);
console.log(`Catalog OK: ${products.length} products, ${units} units.`);

const missing = products.filter((p) => !imageExists(`${productImageDir(p)}/packshot.jpg`)).map((p) => p.id);
if (missing.length) console.warn(`Missing packshots (run npm run gen:placeholders): ${missing.join(', ')}`);

const { videos, liveShows, errors } = loadSpecs();
if (errors.length) {
  console.error(`Video spec errors:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`Video specs OK: ${videos.length} videos, ${liveShows.length} live show(s).`);
