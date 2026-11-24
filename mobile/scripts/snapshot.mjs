// Refreshes the hardcoded product response from the store's live mock API, for every market and each of its
// languages (keys "ch" for English, "ch/fr" for French): npm run snapshot
// Uses the same API base as the app (src/config.ts): pass another with STORE_API=https://…/api.
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8');
const api = process.env.STORE_API ?? config.match(/api: '([^']+)'/)?.[1];
if (!api) throw new Error('No API base in src/config.ts');
const list = await (await fetch(`${api}/markets.json`)).json();
const markets = {};
for (const m of list.markets) {
  for (const lang of m.languages ?? ['en']) {
    const key = lang === 'en' ? m.id : `${m.id}/${lang}`;
    const res = await fetch(`${api}/${key}/products.json`);
    if (!res.ok) throw new Error(`${api}/${key}/products.json answered ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.products) || !data.products.length) throw new Error(`No products for ${key}`);
    markets[key] = { currency: data.currency, language: lang, products: data.products };
    console.log(`${key}: ${data.products.length} products in ${data.currency}, ${lang}`);
  }
}
const out = new URL('../src/shopping/catalog.snapshot.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify({ source: api, savedAt: new Date().toISOString().slice(0, 10), markets }, null, 2)}\n`);
