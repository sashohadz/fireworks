// Shopping Integration V2: the merchant-side script that connects Firework's player to this store.
// - Hydration: the player shows prices, stock and links from the mock commerce API, matched by external ID.
// - Cart sync: Add to Bag in the player fills the site's bag, and the player's cart lists the site's bag.
// Runs on every page that uses the sandbox channel. The failure switches in src/lab/shopping.ts reproduce tickets.
// https://docs.firework.com/firework-for-developers/web/integration-guide/shopping-integration-v2
import { QUANTITY_LIMIT, SLOW_MS, readSwitches, type ShoppingSwitch } from '../lab/shopping';
import { getCart, setLine } from './cart';
import { fetchProducts, type ApiProduct, type ApiUnit } from './products-client';
import type { EffectiveSettings } from './settings';

export interface ShoppingStatus {
  on: boolean;
  reason: string;
  switches: ShoppingSwitch[];
}

export interface ShoppingLogEntry {
  id: number;
  /** Milliseconds since page load. */
  at: number;
  hook: string;
  input: string;
  output: string;
  ms: number;
  error: boolean;
}

const log: ShoppingLogEntry[] = [];
const listeners = new Set<(entry: ShoppingLogEntry) => void>();
let nextId = 1;

export const getShoppingLog = (): ShoppingLogEntry[] => log.slice();
export function onShoppingLog(fn: (entry: ShoppingLogEntry) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function record(entry: Omit<ShoppingLogEntry, 'id'>): void {
  const full = { id: nextId++, ...entry };
  log.push(full);
  if (log.length > 200) log.shift();
  listeners.forEach((fn) => fn(full));
}

/** Runs one hook, timing it and writing the result or error to the log. Errors still reach the player. */
async function logged<T>(hook: string, input: string, run: () => Promise<T>, describe: (result: T) => string): Promise<T> {
  const started = performance.now();
  const at = Math.round(started);
  try {
    const result = await run();
    record({ at, hook, input, output: describe(result), ms: Math.round(performance.now() - started), error: false });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    record({ at, hook, input, output: message, ms: Math.round(performance.now() - started), error: true });
    throw e;
  }
}

export function shoppingStatus(settings: EffectiveSettings): ShoppingStatus {
  const switches = readSwitches();
  const off = (reason: string) => ({ on: false, reason, switches });
  if (settings.fwMode === 'off') return off('The Firework SDK is off on this page (?fw=off).');
  if (!settings.isSandbox) return off('Off on other channels: their products are not in this store\'s catalog.');
  if (switches.includes('no-hydration') && switches.includes('no-cart')) return off('Both hydration and cart sync are switched off.');
  const parts = [!switches.includes('no-hydration') && 'hydration', !switches.includes('no-cart') && 'cart sync'].filter(Boolean);
  return { on: true, reason: `Running on every page: ${parts.join(' and ')}.`, switches };
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Links follow the site the shopper is on, so localhost and deploy previews link to themselves. */
const local = (url: string) => {
  const u = new URL(url);
  return new URL(u.pathname + u.search, location.origin).href;
};

const unitLabel = (id: string | undefined, product?: ApiProduct) =>
  product ? `${product.name} (${product.units.find((u) => u.id === id)?.name ?? id})` : (id ?? 'unknown unit');

function install(shopping: FwShopping, switches: ShoppingSwitch[]): void {
  const has = (s: ShoppingSwitch) => switches.includes(s);

  /** The store's backend: slow or failing when a switch says so. */
  async function store(part: 'products' | 'cart'): Promise<ApiProduct[]> {
    if (has('slow')) await wait(SLOW_MS);
    if (part === 'products' && has('api-error')) throw new Error('The store\'s product API returned 503. (Lab switch: Product API fails)');
    if (part === 'cart' && has('cart-error')) throw new Error('The store\'s cart did not respond, so your bag was not changed. (Lab switch: Cart API fails)');
    return fetchProducts();
  }

  function findUnit(catalog: ApiProduct[], unitId: string | undefined): { product: ApiProduct; unit: ApiUnit } | undefined {
    for (const product of catalog) {
      const unit = product.units.find((u) => u.id === unitId);
      if (unit) return { product, unit };
    }
    return undefined;
  }

  /** A Firework product from the store's data. Cart items need every required field; hydration only what changes. */
  function toFirework(p: ApiProduct, complete: boolean): unknown {
    return shopping.productFactory((b) => {
      b.extId(p.id).currency(p.currency);
      if (complete) b.name(p.name).description(p.summary);
      p.units.forEach((u, i) =>
        b.variant((v) => {
          v.extId(u.id)
            .sku(u.id)
            .url(local(u.url))
            // Both prices: a price alone shows as a sale against the Business Portal price.
            .price(u.price)
            .originalPrice(u.compareAtPrice ?? u.price)
            .isAvailable(u.available);
          if (complete) {
            v.name(u.name)
              .option(u.option)
              .image((img) => img.extId(`${u.id}-image`).url(local(u.image)).title(`${p.name}, ${u.name}`).position(i));
          }
        }),
      );
    }, complete);
  }

  async function hydrate(products: FwProduct[]): Promise<unknown[]> {
    const catalog = await store('products');
    const known = products.map((fw) => catalog.find((p) => p.id === fw.product_ext_id)).filter((p): p is ApiProduct => Boolean(p));
    return [...new Set(known)].map((p) => toFirework(p, false));
  }

  const describeProducts = (products: FwProduct[]) => {
    const extIds = [...new Set(products.map((p) => p.product_ext_id ?? '(no external ID)'))];
    return `${extIds.length} product${extIds.length === 1 ? '' : 's'}: ${extIds.join(', ')}`;
  };
  const describeHydrated = (out: unknown[]) => `${out.length} product${out.length === 1 ? '' : 's'} with the store's prices, stock and links`;

  if (!has('no-cart')) {
    shopping.configureCart({ url: new URL('/cart', location.origin).href, currency: 'EUR' });
    record({ at: Math.round(performance.now()), hook: 'configureCart', input: 'url /cart, currency EUR', output: 'Add to Bag on', ms: 0, error: false });

    shopping.onCartUpdated((update) =>
      logged(
        'onCartUpdated',
        `${update.productUnit?.unit_ext_id ?? '?'}: ${update.previousQuantity} → ${update.quantity}`,
        async () => {
          const catalog = await store('cart');
          const found = findUnit(catalog, update.productUnit?.unit_ext_id);
          if (!found) throw new Error(`${update.productUnit?.unit_name ?? 'This product'} is not in the Fjordbloom catalog, so it can't go in the bag.`);
          const adding = update.quantity > update.previousQuantity;
          if (adding && !found.unit.available) throw new Error(`${unitLabel(found.unit.id, found.product)} is sold out.`);
          let quantity = adding ? Math.min(update.quantity, found.unit.stock) : update.quantity;
          if (has('limit')) quantity = Math.min(quantity, QUANTITY_LIMIT);
          setLine(found.product.id, found.unit.id, quantity, 'player');
          return quantity;
        },
        (quantity) => `${quantity}${quantity === 0 ? ' (removed)' : ''}, saved in the site's bag`,
      ),
    );

    shopping.onCartDisplayed(() =>
      logged(
        'onCartDisplayed',
        'player asked for the cart',
        async () => {
          const catalog = await store('cart');
          return getCart().flatMap((line) => {
            const found = findUnit(catalog, line.unitId);
            return found ? [{ product: toFirework(found.product, true), unitId: line.unitId, quantity: line.quantity }] : [];
          });
        },
        (items) => (items.length ? items.map((i) => `${i.unitId} × ${i.quantity}`).join(', ') : 'the site\'s bag is empty'),
      ),
    );
  }

  if (!has('no-hydration')) {
    // Per video, for single-video widgets such as the Storyblock.
    shopping.onProductsLoaded(({ products }) => logged('onProductsLoaded', describeProducts(products), () => hydrate(products), describeHydrated));
    // Per widget, as soon as its videos load, for carousels, grids and the Player Deck.
    shopping.onWidgetProductsLoaded?.(({ products }) => logged('onWidgetProductsLoaded', describeProducts(products), () => hydrate(products), describeHydrated));
  }
}

export function initShopping(settings: EffectiveSettings): void {
  const status = shoppingStatus(settings);
  window.__fjb = { ...(window.__fjb ?? {}), shopping: { status, log } };
  if (!status.on) return;
  let installed = false;
  const register = () => {
    const shopping = window._fwn?.shopping;
    if (installed || !shopping) return;
    installed = true;
    install(shopping, status.switches);
  };
  // Firework's documented pattern: use window._fwn.shopping if it is there, otherwise wait for fw:ready.
  register();
  document.addEventListener('fw:ready', register);
  document.addEventListener('fw:shopping:ready', register);
}
