// Client-side access to the mock commerce API in the shopper's market (/api/{market}/products.json), memoised per
// page view. The price-drop and sold-out switches from /lab/shopping change the data here, so the player, bag and
// checkout agree.
import { applyScenario, readSwitches } from '../lab/shopping';
import type { Language } from '../lib/markets';
import { currentMarket } from './market';

export { formatMoney } from './market';

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
  market?: string;
  units: ApiUnit[];
}

const cache = new Map<string, Promise<ApiProduct[]>>();

/** The market's API path in a language, also for logs: e.g. /api/ch/products.json, /api/ch/fr/products.json. */
export const productsUrl = (lang: Language = 'en'): string => `/api/${currentMarket().id}${lang === 'en' ? '' : `/${lang}`}/products.json`;

/**
 * The market's products. English by default: the store's own pages (bag, checkout, orders) are English. The player
 * hooks ask in the shopper's language (src/scripts/shopping.ts), so only what Firework shows is translated.
 */
export function fetchProducts(lang: Language = 'en'): Promise<ApiProduct[]> {
  const url = productsUrl(lang);
  let request = cache.get(url);
  if (!request) {
    request = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Mock API returned ${r.status}`);
        return r.json() as Promise<{ products: ApiProduct[] }>;
      })
      .then((data) => applyScenario(data.products, readSwitches()));
    cache.set(url, request);
  }
  return request;
}

let euroCatalog: Promise<ApiProduct[]> | null = null;

/**
 * The EUR catalog (/api/products.json): what Firework's own catalog holds. Hydration uses it for products the
 * shopper's market doesn't sell, to mark them unavailable there.
 */
export function fetchEuroCatalog(): Promise<ApiProduct[]> {
  euroCatalog ??= fetch('/api/products.json')
    .then((r) => {
      if (!r.ok) throw new Error(`Mock API returned ${r.status}`);
      return r.json() as Promise<{ products: ApiProduct[] }>;
    })
    .then((data) => data.products);
  return euroCatalog;
}

export async function findUnit(unitId: string): Promise<{ product: ApiProduct; unit: ApiUnit } | undefined> {
  for (const product of await fetchProducts()) {
    const unit = product.units.find((u) => u.id === unitId);
    if (unit) return { product, unit };
  }
  return undefined;
}

