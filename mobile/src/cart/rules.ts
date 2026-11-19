/**
 * What "Add to cart" in Firework's player does, as pure functions: whether the unit can go in the cart, and what a
 * placed order reports to Firework. install.ts and checkout.ts connect them to the SDK.
 */
import type { Product, TrackPurchaseParameters } from 'react-native-firework-sdk';
import type { ApiProduct } from '../shopping/api';
import type { CartLine } from './cart';

export type AddDecision = { ok: true; line: Omit<CartLine, 'quantity'> } | { ok: false; reason: string };

/**
 * `api` is the store's product (names, stock); `hydrated` is the same product as the player shows it (price after
 * the demo sale, availability after the sold-out switch). The reason is shown to the shopper in the player.
 */
export function decideAdd(unitId: string, api: ApiProduct | undefined, hydrated: Product | undefined, inCart: number): AddDecision {
  const unit = api?.units.find((u) => u.id === unitId);
  const shown = hydrated?.units?.find((u) => u.unitId === unitId);
  if (!api || !unit) return { ok: false, reason: 'This product isn’t sold in this shop.' };
  if (shown?.isAvailable === false || !unit.available) return { ok: false, reason: `${api.name} (${unit.name}) is sold out.` };
  if (inCart >= unit.stock) return { ok: false, reason: `Only ${unit.stock} in stock, and they’re all in your cart.` };
  return {
    ok: true,
    line: {
      productId: api.id,
      unitId: unit.id,
      name: api.name,
      unitName: unit.name,
      price: shown?.price?.amount ?? unit.price,
      regularPrice: unit.compareAtPrice ?? unit.price,
      stock: unit.stock,
    },
  };
}

/**
 * The confirmation the player shows after a successful Add to cart. Firework's Android bridge shows any `tips` text
 * in the result as a toast, for success as well as failure; without it the only sign is the cart icon's red dot.
 */
export function addedMessage(line: Pick<CartLine, 'name' | 'unitName'>, itemsInCart: number): string {
  return `Added to cart: ${line.name} (${line.unitName}) · ${itemsInCart} item${itemsInCart === 1 ? '' : 's'} in cart`;
}

/**
 * Firework's purchase event for an order, in the shape its docs ask for (parity with the web's analytics.purchase).
 * sku is the unit ID, as in Firework's catalog, so Firework can match the order to the videos the shopper watched.
 */
export function purchaseFor(orderId: string, lines: CartLine[], currencyCode = 'EUR'): TrackPurchaseParameters {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;
  return {
    orderId,
    value: subtotal, // no shipping or tax in this demo
    subtotal,
    currencyCode,
    products: lines.map((l) => ({ sku: l.unitId, extProductId: l.productId, price: l.price, quantity: l.quantity, productName: `${l.name} (${l.unitName})` })),
  };
}
