/**
 * The store's mock commerce API, as served by the website (src/pages/api in the repo root, shape from toApiProduct()
 * in src/lib/catalog.ts). Two sources with the same answer: the live API, and a hardcoded snapshot of it that ships
 * with the app (npm run snapshot refreshes it).
 */
import { store } from '../config';
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
  summary: string;
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

/** One request per product, like a real product API: GET /api/products/{id}.json. A 404 means the store doesn't sell it. */
export async function fromLiveApi(ids: string[], getJson: GetJson = xhrGetJson): Promise<Lookup> {
  const answers = await Promise.all(
    ids.map(async (id) => {
      const res = await getJson(`${store.api}/products/${encodeURIComponent(id)}.json`);
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

const bundled = (snapshot as { products: ApiProduct[] }).products;

/** The hardcoded response: the same catalog, bundled with the app, so it works offline. */
export function fromSnapshot(ids: string[], products: ApiProduct[] = bundled): Lookup {
  const found = ids.map((id) => products.find((p) => p.id === id)).filter((p): p is ApiProduct => Boolean(p));
  return { found, unknown: ids.filter((id) => !found.some((p) => p.id === id)) };
}
