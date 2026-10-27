// Product feeds that Firework can import, generated from the catalog at build time.
// The same external IDs are used everywhere: item_group_id / Product External ID = product.id,
// g:id / Product Unit External ID = unit.id.
import {
  absoluteUrl,
  brand,
  defaultUnit,
  isUnitAvailable,
  productImages,
  productPath,
  products,
  unitImage,
} from './catalog';

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const money = (n: number) => `${n.toFixed(2)} EUR`;

/** Google Merchant style RSS 2.0 feed, one item per unit (variant). For "Import via Google XML" and auto-sync. */
export function googleXmlFeed(site: string | URL | undefined): string {
  const items: string[] = [];
  for (const p of products) {
    const extraImages = productImages(p).slice(1, 3);
    for (const u of p.units) {
      const fields: [string, string][] = [
        ['g:id', u.id],
        ['g:item_group_id', p.id],
        ['g:title', p.units.length > 1 ? `${p.name} - ${u.name}` : p.name],
        ['g:description', p.description],
        ['g:link', absoluteUrl(productPath(p, u), site)],
        ['g:image_link', absoluteUrl(unitImage(p, u), site)],
        ...extraImages.map((img): [string, string] => ['g:additional_image_link', absoluteUrl(img, site)]),
        ['g:availability', isUnitAvailable(u) ? 'in_stock' : 'out_of_stock'],
        ['g:price', money(u.compareAtPrice ?? u.price)],
        ...(u.compareAtPrice ? [['g:sale_price', money(u.price)] as [string, string]] : []),
        ['g:brand', brand.name],
        ['g:mpn', u.id],
        ['g:identifier_exists', 'no'],
        ['g:condition', 'new'],
        ['g:product_type', `Skincare > ${p.category}`],
        ...(u.option.name === 'Size' ? [['g:size', u.option.value] as [string, string]] : []),
        ...(u.option.name === 'Shade' ? [['g:color', u.option.value] as [string, string]] : []),
      ];
      items.push(`    <item>\n${fields.map(([k, v]) => `      <${k}>${xmlEscape(v)}</${k}>`).join('\n')}\n    </item>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(brand.name)} (Firework demo store)</title>
    <link>${xmlEscape(absoluteUrl('/', site))}</link>
    <description>${xmlEscape(brand.disclaimer)}</description>
${items.join('\n')}
  </channel>
</rss>
`;
}

// Header copied from Firework's template (https://business.firework.com/product_template.csv),
// including its spelling of "Orignal".
export const FIREWORK_CSV_HEADER = [
  'Name (required)',
  'Category (optional)',
  'Description (optional)',
  'Price (required)',
  'Product Image (required)',
  'URL (required)',
  'Option1 Name',
  'Option1 Value',
  'Option2 Name',
  'Option2 Value',
  'Option3 Name',
  'Option3 Value',
  'Option4 Name',
  'Option4 Value',
  'Option5 Name',
  'Option5 Value',
  'Unit Price',
  'Unit Image (optional)',
  'Unit URL (optional)',
  'Default Unit (optional)',
  'Product External ID',
  'Product Unit External ID',
  'Product Unit Orignal Price',
  'Product Unit Quantity',
  'Brand',
  'Brand UID',
  'GTIN',
  'MPN',
  'SKU',
  'Hide Price',
];

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Firework's CSV batch-import format: one row per product unit. */
export function fireworkCsv(site: string | URL | undefined): string {
  const rows: (string | number)[][] = [FIREWORK_CSV_HEADER];
  for (const p of products) {
    const def = defaultUnit(p);
    for (const u of p.units) {
      rows.push([
        p.name,
        p.category,
        p.description,
        def.price.toFixed(2),
        absoluteUrl(productImages(p)[0]!, site),
        absoluteUrl(productPath(p), site),
        u.option.name,
        u.option.value,
        '', '', '', '', '', '', '', '',
        u.price.toFixed(2),
        absoluteUrl(unitImage(p, u), site),
        absoluteUrl(productPath(p, u), site),
        u.id === def.id ? 'TRUE' : '',
        p.id,
        u.id,
        u.compareAtPrice ? u.compareAtPrice.toFixed(2) : '',
        u.stock,
        brand.name,
        '',
        '',
        u.id,
        u.id,
        '',
      ]);
    }
  }
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}
