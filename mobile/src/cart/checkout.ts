/** A mock checkout: the order is "placed" in the app, and Firework is told about it so it can attribute the sale. */
import FireworkSDK from 'react-native-firework-sdk';
import { addLog } from '../shopping/log';
import { cartSubtotal, clearCart, getCart } from './cart';
import { purchaseFor } from './rules';

export interface Order {
  id: string;
  total: number;
  items: number;
}

export async function placeOrder(): Promise<Order | undefined> {
  const lines = getCart();
  if (!lines.length) { return undefined; }
  const id = `FJB-APP-${Date.now().toString(36).toUpperCase()}`;
  const params = purchaseFor(id, lines);
  await FireworkSDK.getInstance().trackPurchase(params);
  addLog({
    at: new Date(),
    kind: 'purchase',
    title: 'Purchase → Firework',
    request: `trackPurchase: order ${id}, €${params.value?.toFixed(2)} ${params.currencyCode}`,
    lines: (params.products ?? []).map((p) => ({ ok: true, text: `${p.sku} × ${p.quantity} at €${p.price.toFixed(2)}` })),
  });
  const order = { id, total: cartSubtotal(lines), items: lines.reduce((n, l) => n + l.quantity, 0) };
  clearCart();
  return order;
}
