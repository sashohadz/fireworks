// Store-level help content: one source for the help pages and the AVA knowledge files, so the site and
// the assistant never disagree. Fictional policies for a demo brand. Build-time only (imports the catalog).
import { products } from './catalog';

export interface Faq {
  q: string;
  a: string;
}

export const storeFaqs: Faq[] = [
  { q: 'Where do you ship?', a: 'We ship to every EU country, Norway, Switzerland and the UK. Orders placed before 14:00 CET on a working day leave our Copenhagen warehouse the same day.' },
  { q: 'How much is shipping?', a: 'Shipping within the EU is free on orders from €50. Below that, standard shipping costs €4.90. Norway, Switzerland and the UK cost €9.90.' },
  { q: 'Can I return a product?', a: 'Yes. Unopened products can be returned within 30 days. Opened products can be returned within 14 days if they did not suit your skin.' },
  { q: 'Are your products vegan?', a: 'Yes. Every Fjordbloom product is vegan and cruelty-free. Our lip balm uses candelilla wax instead of beeswax.' },
  { q: 'Which products suit sensitive skin?', a: 'Start with Cloud Milk Cleanser, Arctic Barrier Day Cream and Daylight Mineral Fluid SPF 50. All three are fragrance-free.' },
  { q: 'What is the right order for a routine?', a: 'Morning: cleanser, toner, serum, day cream, then SPF. Evening: cleanser, toner, serum, then night cream.' },
  { q: 'Can I combine vitamin C with niacinamide?', a: 'Yes. Apply Birch Sap Hydra Serum first, wait a minute, then Cloudberry Vitamin C Glow Serum.' },
  { q: 'Do you offer samples?', a: 'The Discovery Set contains four minis and is the best way to try the full ritual.' },
];

export const shippingRates = [
  { destination: 'Denmark', time: '1 to 2 working days', cost: 'Free from €50, otherwise €4.90' },
  { destination: 'Rest of the EU', time: '2 to 5 working days', cost: 'Free from €50, otherwise €4.90' },
  { destination: 'Norway, Switzerland, UK', time: '3 to 7 working days', cost: '€9.90; duties may apply' },
];

export const dispatchNote =
  'Orders placed before 14:00 CET on a working day leave our Copenhagen warehouse the same day. You get a tracking link by email.';

export const returnRules = [
  'Unopened products: return within 30 days for a full refund.',
  'Opened products that did not suit your skin: return within 14 days and we refund the product price.',
  'Sale items, including the Arctic Barrier Day Cream offer, follow the same rules.',
  'Refunds go back to the original payment method within 5 working days of the return arriving.',
];

export const damagedNote = 'Send a photo within 7 days of delivery and we will send a replacement at no cost.';

/** Sold-out products and shades, straight from the catalog stock. */
export function soldOutItems(): string[] {
  return products.flatMap((p) => {
    const out = p.units.filter((u) => u.stock === 0);
    if (out.length === 0) return [];
    if (out.length === p.units.length) return [p.name];
    return out.map((u) => `${p.shortName} in ${u.name}`);
  });
}

export function soldOutNote(): string {
  const items = soldOutItems();
  if (items.length === 0) return 'Everything is in stock right now.';
  const list = items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  return `Sold out right now: ${list}. Restocks usually take a few weeks.`;
}

/** Fictional contact details on a reserved .example domain. */
export const support = {
  email: 'hello@fjordbloom.example',
  hours: 'Monday to Friday, 9:00 to 17:00 CET',
  languages: 'English, Danish and German',
};

export const glossary = [
  { name: 'Cloudberry seed oil', inci: 'Rubus Chamaemorus Seed Oil', what: 'A cold-pressed Arctic berry oil rich in vitamin E and omega fatty acids. Softens and supports the skin barrier.', in: 'Cloudberry Vitamin C Glow Serum' },
  { name: 'Ethyl ascorbic acid', inci: '3-O-Ethyl Ascorbic Acid', what: 'A stable, gentle form of vitamin C that helps skin look brighter and more even.', in: 'Cloudberry Vitamin C Glow Serum' },
  { name: 'Birch sap', inci: 'Betula Alba Juice', what: 'Sap tapped from birch trees in early spring. Brings minerals, amino acids and natural sugars.', in: 'Birch Sap Hydra Serum, Cloud Milk Cleanser' },
  { name: 'Niacinamide', inci: 'Niacinamide', what: 'Vitamin B3. Supports the skin barrier and helps refine the look of pores.', in: 'Birch Sap Hydra Serum' },
  { name: 'Sea buckthorn oil', inci: 'Hippophae Rhamnoides Fruit Oil', what: 'A bright orange berry oil with omega-7. Gives the night cream its natural tint.', in: 'Midnight Night Cream, Cloud Milk Cleanser, Sauna Body Oil' },
  { name: 'Bakuchiol', inci: 'Bakuchiol', what: 'A plant-derived ingredient often used as a gentler alternative to retinol.', in: 'Midnight Sea Buckthorn Night Cream' },
  { name: 'Hyaluronic acid', inci: 'Sodium Hyaluronate', what: 'A humectant that holds water in the skin. We use three molecular weights.', in: 'Glacier Water Essence Toner, Birch Sap Hydra Serum' },
  { name: 'Ceramides', inci: 'Ceramide NP', what: 'Lipids that occur naturally in skin and help keep the barrier intact.', in: 'Arctic Barrier Day Cream, Midnight Night Cream' },
  { name: 'Zinc oxide', inci: 'Zinc Oxide', what: 'A mineral UV filter that reflects and absorbs UVA and UVB light.', in: 'Daylight Mineral Fluid SPF 50' },
  { name: 'Bladderwrack kelp', inci: 'Fucus Vesiculosus Extract', what: 'A Nordic seaweed that keeps skin comfortable while clay works.', in: 'Sea Kelp Clay Mask' },
  { name: 'Lingonberry seed oil', inci: 'Vaccinium Vitis-Idaea Seed Oil', what: 'A light Nordic berry oil that softens lips.', in: 'Lingonberry Tinted Lip Balm' },
];
