// Failure switches for the shopping integration (src/scripts/shopping.ts). Each one reproduces a common ticket.
// They last for the browser tab (sessionStorage), so a whole journey from video to checkout uses the same store.
// Set them on /lab/shopping or with ?shopping=slow,sold-out. Unknown names are ignored. Safe to import from client code.

export type ShoppingSwitch = 'no-hydration' | 'no-cart' | 'slow' | 'api-error' | 'cart-error' | 'sold-out' | 'price-drop' | 'limit';

export interface SwitchDef {
  id: ShoppingSwitch;
  label: string;
  /** What the shopper sees, as tested with the live SDK. */
  shopper: string;
  /** The ticket it reproduces. */
  ticket: string;
}

export const SLOW_MS = 4000;
export const QUANTITY_LIMIT = 2;
export const PRICE_DROP = 0.2;

export const shoppingSwitches: SwitchDef[] = [
  {
    id: 'no-cart',
    label: 'Cart sync off',
    shopper: 'The player shows Shop Now and opens the product page. There is no bag in the player.',
    ticket: '"Add to Bag is missing from the videos."',
  },
  {
    id: 'no-hydration',
    label: 'Hydration off',
    shopper: 'Prices and stock come from Business Portal, and product links go to the URL saved there.',
    ticket: '"The video shows an old price" or "links go to production from our staging site."',
  },
  {
    id: 'slow',
    label: `Slow store API (${SLOW_MS / 1000} s)`,
    shopper: 'Add to Bag spins until the store answers. Prices show the Business Portal value first, then change when hydration returns.',
    ticket: '"Add to Bag hangs" or "the price changes after a few seconds."',
  },
  {
    id: 'api-error',
    label: 'Product API fails',
    shopper: 'No error is shown. The player quietly falls back to Business Portal data. Only the hook log shows the failure.',
    ticket: '"Prices in videos are wrong, but nothing looks broken."',
  },
  {
    id: 'cart-error',
    label: 'Cart API fails',
    shopper: 'Add to Bag shows "Failed to update cart" with the store\'s message. The bag does not change.',
    ticket: '"Shoppers get an error when they add to bag from a video."',
  },
  {
    id: 'sold-out',
    label: 'Everything sold out',
    shopper: 'The player shows Sold Out instead of Add to Bag. The site\'s bag and checkout use the same stock.',
    ticket: '"Sold-out products can still be bought from videos" (when hydration is missing).',
  },
  {
    id: 'price-drop',
    label: `Price drop (${PRICE_DROP * 100}% off)`,
    shopper: 'The player shows the sale price with the old price crossed out. The bag and checkout charge the same price.',
    ticket: '"The video price doesn\'t match checkout."',
  },
  {
    id: 'limit',
    label: `Limit ${QUANTITY_LIMIT} per item`,
    shopper: `The store accepts at most ${QUANTITY_LIMIT} of each item. The player shows the quantity the store returns.`,
    ticket: '"The quantity in the player jumps back."',
  },
];

const KEY = 'fjb.shopping.v1';
const ids = new Set<string>(shoppingSwitches.map((s) => s.id));

export function parseSwitches(value: string): ShoppingSwitch[] {
  const names = value === 'off' ? ['no-hydration', 'no-cart'] : value.split(',').map((s) => s.trim());
  return [...new Set(names)].filter((s): s is ShoppingSwitch => ids.has(s));
}

export function readSwitches(): ShoppingSwitch[] {
  try {
    return parseSwitches(window.sessionStorage.getItem(KEY) ?? '');
  } catch {
    return [];
  }
}

export function saveSwitches(list: ShoppingSwitch[]): void {
  try {
    if (list.length) window.sessionStorage.setItem(KEY, list.join(','));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: switches only apply through the URL */
  }
}

/** ?shopping=… sets the switches for this tab; an empty value turns them all off. */
export function syncSwitchesFromUrl(search: string = location.search): void {
  const q = new URLSearchParams(search);
  if (q.has('shopping')) saveSwitches(parseSwitches(q.get('shopping') ?? ''));
}

export const switchLabel = (id: ShoppingSwitch) => shoppingSwitches.find((s) => s.id === id)?.label ?? id;

interface ScenarioPrice {
  price: number;
  compareAtPrice: number | null;
  available: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The store's own data under the price-drop and sold-out switches, so the player, bag and checkout agree. */
export function applyScenario<P extends ScenarioPrice & { units: (ScenarioPrice & { stock: number })[] }>(products: P[], switches: ShoppingSwitch[]): P[] {
  const soldOut = switches.includes('sold-out');
  const drop = switches.includes('price-drop');
  if (!soldOut && !drop) return products;
  const change = <T extends ScenarioPrice>(x: T): T => ({
    ...x,
    ...(drop ? { price: round2(x.price * (1 - PRICE_DROP)), compareAtPrice: x.compareAtPrice ?? x.price } : {}),
    ...(soldOut ? { available: false } : {}),
  });
  return products.map((p) => ({ ...change(p), units: p.units.map((u) => ({ ...change(u), ...(soldOut ? { stock: 0 } : {}) })) }) as P);
}

/** What a developer adds to their store, shown on /lab/shopping. Same calls as src/scripts/shopping.ts, minus the lab switches. */
export const integrationSnippet = `<script>
  // Add once per page, next to the Firework script. "store" stands for your own commerce API.
  function whenShoppingReady(fn) {
    if (window._fwn?.shopping) fn(window._fwn.shopping);
    else document.addEventListener('fw:ready', () => fn(window._fwn.shopping), { once: true });
  }

  whenShoppingReady((shopping) => {
    // 1. Cart sync: the player gets Add to Bag instead of Shop Now.
    shopping.configureCart({ url: location.origin + '/cart', currency: 'EUR' });

    // 2. Hydration: the store's current price, stock and links, matched by external ID.
    shopping.onProductsLoaded(async ({ products }) => {
      const latest = await store.getProducts(products.map((p) => p.product_ext_id));
      return latest.map(toFirework);
    });

    // 3. Player to store. quantity is the new total. Return the quantity your cart accepted.
    shopping.onCartUpdated(async ({ productUnit, quantity }) => {
      const line = await store.setQuantity(productUnit.unit_ext_id, quantity);
      return line.quantity;
    });

    // 4. Store to player: the player's cart lists your cart.
    shopping.onCartDisplayed(async () => {
      const cart = await store.getCart();
      return cart.lines.map((l) => ({ product: toFirework(l.product), unitId: l.unitId, quantity: l.quantity }));
    });

    function toFirework(p) {
      return shopping.productFactory((b) => {
        b.extId(p.id).name(p.name).description(p.summary).currency('EUR');
        for (const u of p.units) {
          b.variant((v) =>
            v.extId(u.id).sku(u.id).name(u.name).url(u.url)
              // Send both prices: a price alone shows as a sale against the Business Portal price.
              .price(u.price).originalPrice(u.compareAtPrice ?? u.price)
              .isAvailable(u.available),
          );
        }
      });
    }
  });
</script>`;
