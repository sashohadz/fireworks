/**
 * The store's mock commerce API, as served by the website (src/pages/api in the repo root, shape from toApiProduct()
 * in src/lib/catalog.ts), per country: /api/{market}/products/{id}.json. Two sources with the same answer: the live
 * API, and a hardcoded snapshot of it for every market that ships with the app (npm run snapshot refreshes it).
 */
import { store } from '../config';
import { catalogKey, type CatalogKey } from '../market';
import snapshot from './catalog.snapshot.json';

export interface ApiUnit {
  id: string;
  name: string;
  option: { name: string; value: string };
  price: number;
  compareAtPrice: number | null;
  stock: number;
  available: boolean;
  isDefault: boolean;
  url: string;
  image: string;
}

export interface ApiProduct {
  id: string;
  handle: string;
  name: string;
  /** Only in a language other than the catalog's English (Firework's catalog has no subtitles). */
  subtitle?: string | null;
  summary: string;
  /** The language of name, subtitle and summary: 'en' is the catalog's own text. */
  language?: string;
  category: string;
  url: string;
  image: string;
  available: boolean;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  units: ApiUnit[];
}

export interface Lookup {
  found: ApiProduct[];
  /** IDs the store doesn't know: Firework's own product data stays as it is for these. */
  unknown: string[];
  /** Answered from the country's price list in memory, without a request. */
  cached?: boolean;
}

export type GetJson = (url: string) => Promise<{ status: number; body: unknown }>;

/**
 * GET with XMLHttpRequest, not fetch. Firework's player is its own Android activity, so while it is open the React
 * Native activity is paused, and React Native pauses JavaScript timers with it. fetch (whatwg-fetch) hands its
 * response over in a setTimeout, so inside onUpdateProductDetails it would hang until the shopper leaves the player.
 * XMLHttpRequest events come straight from the native networking module, and the timeout is enforced natively too.
 */
export const xhrGetJson: GetJson = (url) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.timeout = 4000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = () => {
      try {
        resolve({ status: xhr.status, body: xhr.status === 200 ? JSON.parse(xhr.responseText) : null });
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(new Error(`Network error for ${url}`));
    xhr.ontimeout = () => reject(new Error(`Timed out after 4 s: ${url}`));
    xhr.send();
  });

/**
 * One request per product, like a real product API: GET /api/{market}/products/{id}.json, or
 * /api/{market}/{lang}/products/{id}.json in another language. A 404 means the store doesn't sell it in that market.
 */
export async function fromLiveApi(ids: string[], market: CatalogKey = catalogKey(), getJson: GetJson = xhrGetJson): Promise<Lookup> {
  const answers = await Promise.all(
    ids.map(async (id) => {
      const res = await getJson(`${store.api}/${market}/products/${encodeURIComponent(id)}.json`);
      if (res.status === 404) { return { id, product: undefined }; }
      if (res.status !== 200) { throw new Error(`Product API answered ${res.status} for ${id}`); }
      return { id, product: res.body as ApiProduct };
    }),
  );
  return {
    found: answers.flatMap((a) => (a.product ? [a.product] : [])),
    unknown: answers.filter((a) => !a.product).map((a) => a.id),
  };
}

/**
 * The country's whole price list, kept in memory for a few minutes, so hydration answers at once. Until Firework gets
 * the app's answer, the player shows the price stored in Firework (EUR here), so a slow answer shows as a flash of the
 * wrong currency. Loaded when the app starts and when the country changes (prefetchMarket).
 */
export const CACHE_MS = 5 * 60 * 1000;
const priceLists = new Map<CatalogKey, { at: number; byId: Map<string, ApiProduct> }>();

/** Loads a market's price list, in a language when the key has one ('ch/fr'): its own entry in memory. */
export async function prefetchMarket(market: CatalogKey = catalogKey(), getJson: GetJson = xhrGetJson): Promise<number> {
  const res = await getJson(`${store.api}/${market}/products.json`);
  if (res.status !== 200) { throw new Error(`Product API answered ${res.status} for the ${market} price list`); }
  const list = (res.body as { products: ApiProduct[] }).products;
  priceLists.set(market, { at: Date.now(), byId: new Map(list.map((p) => [p.id, p])) });
  return list.length;
}

/** From the country's price list in memory, or undefined if it isn't loaded or is too old. Not in the list = not sold. */
export function fromCache(ids: string[], market: CatalogKey = catalogKey(), now = Date.now()): Lookup | undefined {
  const list = priceLists.get(market);
  if (!list || now - list.at > CACHE_MS) { return undefined; }
  return { found: ids.flatMap((id) => list.byId.get(id) ?? []), unknown: ids.filter((id) => !list.byId.has(id)), cached: true };
}

export const clearPriceLists = () => priceLists.clear();

const bundled = (snapshot as unknown as { markets: Partial<Record<CatalogKey, { products: ApiProduct[] }>> }).markets;

/** A market's bundled catalog (the hardcoded response), in a language when the key has one ('ch/fr'). */
export const snapshotProducts = (market: CatalogKey = catalogKey()): ApiProduct[] => bundled[market]?.products ?? [];

/** The hardcoded response: the same catalog per market and language, bundled with the app, so it works offline. */
export function fromSnapshot(ids: string[], market: CatalogKey = catalogKey(), products: ApiProduct[] = snapshotProducts(market)): Lookup {
  const found = ids.map((id) => products.find((p) => p.id === id)).filter((p): p is ApiProduct => Boolean(p));
  return { found, unknown: ids.filter((id) => !found.some((p) => p.id === id)) };
}
