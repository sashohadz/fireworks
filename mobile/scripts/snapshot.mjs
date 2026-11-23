// Refreshes the hardcoded product response from the store's live mock API, for every market: npm run snapshot
// Uses the same API base as the app (src/config.ts): pass another with STORE_API=https://…/api.
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8');
const api = process.env.STORE_API ?? config.match(/api: '([^']+)'/)?.[1];
if (!api) throw new Error('No API base in src/config.ts');
const list = await (await fetch(`${api}/markets.json`)).json();
const markets = {};
for (const m of list.markets) {
  const res = await fetch(`${api}/${m.id}/products.json`);
  if (!res.ok) throw new Error(`${api}/${m.id}/products.json answered ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.products) || !data.products.length) throw new Error(`No products for ${m.id}`);
  markets[m.id] = { currency: data.currency, products: data.products };
  console.log(`${m.id}: ${data.products.length} products in ${data.currency}`);
}
const out = new URL('../src/shopping/catalog.snapshot.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify({ source: api, savedAt: new Date().toISOString().slice(0, 10), markets }, null, 2)}\n`);
