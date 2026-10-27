// Builds demo orders from the cart. Prices come from the mock commerce API, never from the client cart.
import type { CartLine } from './cart';
import { fetchProducts } from './products-client';
import type { DemoOrder, DemoOrderLine } from './tracking';

export const FREE_SHIPPING_FROM = 50;
export const SHIPPING_FEE = 4.9;
const ORDER_KEY = 'fjb.lastOrder.v1';

export async function priceCart(lines: CartLine[]): Promise<{ lines: DemoOrderLine[]; subtotal: number; shipping: number; total: number }> {
  const products = await fetchProducts();
  const priced: DemoOrderLine[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.units.some((u) => u.id === line.unitId));
    const unit = product?.units.find((u) => u.id === line.unitId);
    if (!product || !unit) continue;
    priced.push({ productId: product.id, unitId: unit.id, name: product.name, unitName: unit.name, quantity: line.quantity, price: unit.price });
  }
  const subtotal = Math.round(priced.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100;
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  return { lines: priced, subtotal, shipping, total: Math.round((subtotal + shipping) * 100) / 100 };
}

export async function createOrder(lines: CartLine[]): Promise<DemoOrder> {
  const priced = await priceCart(lines);
  const order: DemoOrder = {
    id: `FJB-DEMO-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    currency: 'EUR',
    ...priced,
  };
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify({ order, tracked: false }));
  } catch {
    /* ignore */
  }
  return order;
}

export function readLastOrder(): { order: DemoOrder; tracked: boolean } | null {
  try {
    return JSON.parse(sessionStorage.getItem(ORDER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function markTracked(): void {
  const last = readLastOrder();
  if (!last) return;
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify({ ...last, tracked: true }));
  } catch {
    /* ignore */
  }
}
