import { addToCart, cartCount, cartSubtotal, clearCart, getCart, quantityInCart, setQuantity } from '../src/cart/cart';
import { addedMessage, decideAdd, purchaseFor } from '../src/cart/rules';
import type { ApiProduct } from '../src/shopping/api';
import { toFireworkProduct } from '../src/shopping/hydration';
import snapshot from '../src/shopping/catalog.snapshot.json';

const catalog = (snapshot as { products: ApiProduct[] }).products;
const byId = (id: string) => catalog.find((p) => p.id === id)!;

beforeEach(() => clearCart());

describe('decideAdd: Add to cart in the player', () => {
  test('a known, available unit goes in at the price the player showed', () => {
    const p = byId('FJB-101');
    const d = decideAdd('FJB-101-150ML', p, toFireworkProduct(p), 0);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.line).toMatchObject({ productId: 'FJB-101', unitId: 'FJB-101-150ML', price: p.units[0]!.price });
    }
  });

  test('the demo sale price is the cart price, with the regular price kept', () => {
    const p = byId('FJB-101');
    const d = decideAdd('FJB-101-150ML', p, toFireworkProduct(p, { sale: 0.8 }), 0);
    expect(d.ok && d.line.price).toBe(Math.round(p.units[0]!.price * 80) / 100);
    expect(d.ok && d.line.regularPrice).toBe(p.units[0]!.price);
  });

  test('unknown product or unit: refused with a reason', () => {
    expect(decideAdd('X-1', undefined, undefined, 0)).toMatchObject({ ok: false });
    const p = byId('FJB-101');
    expect(decideAdd('FJB-999-NOPE', p, toFireworkProduct(p), 0)).toMatchObject({ ok: false });
  });

  test('a sold-out unit is refused (real stock 0, or the Sold out switch)', () => {
    const plum = byId('FJB-109');
    expect(decideAdd('FJB-109-PLUM', plum, toFireworkProduct(plum), 0)).toMatchObject({ ok: false, reason: expect.stringMatching(/sold out/) });
    const p = byId('FJB-101');
    expect(decideAdd('FJB-101-150ML', p, toFireworkProduct(p, { soldOut: true }), 0)).toMatchObject({ ok: false });
  });

  test('never more than the stock', () => {
    const p = byId('FJB-109');
    const heather = p.units.find((u) => u.id === 'FJB-109-HEATHER')!;
    expect(decideAdd(heather.id, p, toFireworkProduct(p), heather.stock)).toMatchObject({ ok: false, reason: expect.stringMatching(/in stock/) });
  });
});

describe('cart', () => {
  const line = { productId: 'FJB-101', unitId: 'FJB-101-150ML', name: 'Cleanser', unitName: '150 ml', price: 24, regularPrice: 24, stock: 3 };

  test('the same unit twice is one line with quantity 2', () => {
    addToCart(line);
    addToCart(line);
    expect(getCart()).toHaveLength(1);
    expect(quantityInCart('FJB-101-150ML')).toBe(2);
    expect(cartCount()).toBe(2);
    expect(cartSubtotal()).toBe(48);
  });

  test('quantity is capped at the stock, and 0 removes the line', () => {
    addToCart(line);
    setQuantity('FJB-101-150ML', 10);
    expect(quantityInCart('FJB-101-150ML')).toBe(3);
    setQuantity('FJB-101-150ML', 0);
    expect(getCart()).toHaveLength(0);
  });
});

describe('purchaseFor: what Firework is told at checkout', () => {
  test('required fields, sku = unit ID, value = subtotal', () => {
    const lines = [
      { productId: 'FJB-101', unitId: 'FJB-101-150ML', name: 'Cleanser', unitName: '150 ml', price: 19.2, regularPrice: 24, stock: 5, quantity: 2 },
      { productId: 'FJB-109', unitId: 'FJB-109-CLEAR', name: 'Lip Balm', unitName: 'Clear', price: 16, regularPrice: 16, stock: 5, quantity: 1 },
    ];
    const p = purchaseFor('FJB-APP-1', lines);
    expect(p).toMatchObject({ orderId: 'FJB-APP-1', currencyCode: 'EUR', subtotal: 54.4, value: 54.4 });
    expect(p.products).toEqual([
      { sku: 'FJB-101-150ML', extProductId: 'FJB-101', price: 19.2, quantity: 2, productName: 'Cleanser (150 ml)' },
      { sku: 'FJB-109-CLEAR', extProductId: 'FJB-109', price: 16, quantity: 1, productName: 'Lip Balm (Clear)' },
    ]);
  });
});

describe('addedMessage: the confirmation toast in the player', () => {
  test('names the product, the unit and the cart size', () => {
    expect(addedMessage({ name: 'Lingonberry Tinted Lip Balm', unitName: 'Clear' }, 2)).toBe('Added to cart: Lingonberry Tinted Lip Balm (Clear) · 2 items in cart');
    expect(addedMessage({ name: 'Cloud Milk Cleanser', unitName: '150 ml' }, 1)).toMatch(/1 item in cart$/);
  });
});
