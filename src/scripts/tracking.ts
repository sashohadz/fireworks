// Purchase tracking with the Firework web SDK.
// Payload format: https://docs.firework.com/firework-for-developers/web/integration-guide/shopping-integration-v2/tracking/purchase
import { firework } from '../site.config';
import type { EffectiveSettings } from './settings';

export interface DemoOrderLine {
  productId: string;
  unitId: string;
  name: string;
  unitName: string;
  quantity: number;
  price: number;
}

export interface DemoOrder {
  id: string;
  createdAt: string;
  currency: 'EUR';
  lines: DemoOrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
}

export interface TrackResult {
  status: 'sent' | 'skipped' | 'unavailable';
  reason: string;
  payload: ReturnType<typeof purchasePayload>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function purchasePayload(order: DemoOrder) {
  return {
    order_id: order.id,
    currency: order.currency,
    subtotal: round2(order.subtotal),
    order_value: round2(order.total),
    line_items: order.lines.map((l) => ({
      // The SKU can be the product unit external ID, which is how this catalog is imported.
      sku: l.unitId,
      quantity: l.quantity,
      price: l.price,
      product_name: `${l.name} (${l.unitName})`,
    })),
  };
}

function waitFor<T>(get: () => T | undefined, timeoutMs: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const value = get();
      if (value !== undefined) return resolve(value);
      if (Date.now() - started > timeoutMs) return resolve(undefined);
      window.setTimeout(tick, 200);
    };
    tick();
  });
}

export async function trackPurchase(order: DemoOrder, settings: EffectiveSettings): Promise<TrackResult> {
  const payload = purchasePayload(order);
  if (!firework.trackPurchases) return { status: 'skipped', reason: 'purchase tracking is disabled in src/site.config.ts', payload };
  if (settings.fwMode === 'off') return { status: 'skipped', reason: 'the Firework SDK is switched off on this page (?fw=off)', payload };
  if (!settings.isSandbox) {
    const reason = settings.channel
      ? `channel "${settings.channel}" is not the sandbox channel, so no purchase is sent to its analytics`
      : 'no sandbox channel is configured yet in src/site.config.ts';
    return { status: 'skipped', reason, payload };
  }
  const analytics = await waitFor(() => (window._fwn?.analytics?.purchase ? window._fwn.analytics : undefined), 12000);
  if (!analytics?.purchase) {
    return { status: 'unavailable', reason: 'window._fwn.analytics.purchase was not available within 12 seconds', payload };
  }
  analytics.purchase(payload);
  return { status: 'sent', reason: 'sent with window._fwn.analytics.purchase(); look for user:purchase in the network tab', payload };
}
