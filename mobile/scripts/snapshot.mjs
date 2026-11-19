// Refreshes the hardcoded product response from the store's live mock API: npm run snapshot
import fs from 'node:fs';

const url = 'https://fjordbloom.netlify.app/api/products.json';
const res = await fetch(url);
if (!res.ok) throw new Error(`${url} answered ${res.status}`);
const data = await res.json();
if (!Array.isArray(data.products) || !data.products.length) throw new Error('No products in the answer');
const out = new URL('../src/shopping/catalog.snapshot.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify({ source: url, savedAt: new Date().toISOString().slice(0, 10), ...data }, null, 2)}\n`);
console.log(`Saved ${data.products.length} products from ${url}`);
