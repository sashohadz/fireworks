/**
 * Product hydration without the SDK: turns the store's API answer into Firework products, for the mode picked in
 * Settings. Pure functions, so they run in Jest. install.ts connects them to FireworkSDK.
 */
import type { Product, ProductUnit } from 'react-native-firework-sdk';
import { fromCache, fromLiveApi, fromSnapshot, type ApiProduct, type Lookup } from './api';
import type { Mode } from './modes';
import { catalogKey, getLanguage, getMarket, type Language, type Market } from '../market';

export interface Adjust {
  /** Price multiplier for the demo sale, e.g. 0.8 for −20%. The real price becomes the struck-through one. */
  sale?: number;
  /** Every unit sold out. */
  soldOut?: boolean;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * One Firework product from one store product: only what changes from minute to minute (price, original price, stock,
 * link). Every unit is included, not only the one on screen: Firework matches units by unitId, and units left out keep
 * Firework's stored (possibly stale) data.
 *
 * Catalog structure stays Firework's (imported from the product feed). Tested on Android: sending unit options
 * replaced the variant swatches with a plain "Select" list, because the store calls the option "Shade" and Firework's
 * import calls it "color"; sending unit images added the store's image URLs next to Firework's copies (8 → 13 images).
 *
 * In a language other than the catalog's English the text is live too: name, subtitle and description in the
 * shopper's language replace the English that Firework's catalog holds. In English only the name goes (as before).
 */
export function toFireworkProduct(p: ApiProduct, adjust: Adjust = {}): Product {
  const translated = Boolean(p.language && p.language !== 'en');
  const units: ProductUnit[] = p.units.map((u) => {
    const regular = u.compareAtPrice ?? u.price;
    const price = adjust.sale ? cents(u.price * adjust.sale) : u.price;
    return {
      unitId: u.id,
      url: u.url,
      price: { amount: price, currencyCode: p.currency },
      // Always sent (the regular price), so the card strikes a price through only when there really is a lower one.
      originalPrice: { amount: regular, currencyCode: p.currency },
      isAvailable: adjust.soldOut ? false : u.available,
    };
  });
  return {
    productId: p.id,
    name: p.name,
    ...(translated ? { description: p.summary, ...(p.subtitle ? { subtitle: p.subtitle } : {}) } : {}),
    currency: p.currency,
    isAvailable: adjust.soldOut ? false : p.available,
    units,
  };
}

export interface Resolved {
  products: Product[];
  lookup: Lookup;
  /** Where the data came from, for the log. */
  via: string;
  /** Products the shopper's country doesn't sell: returned as hidden, so the videos don't show them. */
  hidden: string[];
}

export interface Deps {
  market: () => Market;
  /** The product text's language; English (the catalog's own text) when left out. */
  language?: () => Language;
  live: (ids: string[], market: Market, lang: Language) => Promise<Lookup>;
  snapshot: (ids: string[], market: Market, lang: Language) => Lookup;
}

const defaultDeps: Deps = {
  market: getMarket,
  language: getLanguage,
  // The country's price list in memory when it's loaded (fast), otherwise one request per product.
  live: async (ids, market, lang) => fromCache(ids, catalogKey(market.id, lang)) ?? fromLiveApi(ids, catalogKey(market.id, lang)),
  snapshot: (ids, market, lang) => fromSnapshot(ids, catalogKey(market.id, lang)),
};

/**
 * What onUpdateProductDetails returns, for the IDs Firework asks about. Firework can repeat an ID (several cards for
 * units of one product), so each product is looked up once. If the live API can't be reached, the bundled copy
 * answers instead, as a real app would fall back to cached data.
 */
export async function resolveProducts(productIds: string[], mode: Mode, deps: Deps = defaultDeps): Promise<Resolved> {
  const ids = [...new Set(productIds)];
  const market = deps.market();
  const lang = deps.language?.() ?? 'en';
  if (mode === 'failing') { throw new Error('Demo: the product API is down (Failing mode)'); }
  // No timers in here (setTimeout, delays): React Native pauses them while Firework's player is open. See api.ts.
  let lookup: Lookup;
  let via: string;
  if (mode === 'hardcoded') {
    lookup = deps.snapshot(ids, market, lang);
    via = 'Hardcoded';
  } else {
    try {
      lookup = await deps.live(ids, market, lang);
      via = lookup.cached ? 'Live API, cached' : 'Live API';
    } catch {
      lookup = deps.snapshot(ids, market, lang);
      via = 'Hardcoded (live API unreachable)';
    }
  }
  const adjust: Adjust = mode === 'sale' ? { sale: 0.8 } : mode === 'soldout' ? { soldOut: true } : {};
  // Not sold in this country: the app SDK can hide a product (the web one can't), so it disappears from the videos.
  const hidden = lookup.unknown.filter((id) => market.notSold.includes(id));
  const products: Product[] = [...lookup.found.map((p) => toFireworkProduct(p, adjust)), ...hidden.map((id) => ({ productId: id, hidden: true }))];
  return { products, lookup: { ...lookup, unknown: lookup.unknown.filter((id) => !hidden.includes(id)) }, via: `${via} · ${market.label}${lang === 'en' ? '' : ` · ${lang}`}`, hidden };
}
