// Firework tracking: page views, bag changes and purchases, sent with window._fwn.analytics.
// analytics.js goes in the head of every page that sends events (loadAnalyticsScript in firework-loader.ts).
// Events only go to the sandbox channel's analytics. /lab/tracking shows what this tab sent.
// https://docs.firework.com/firework-for-developers/web/integration-guide/shopping-integration-v2/tracking
import { firework } from '../site.config';
import { onCartWrite, type CartChange, type CartLine } from './cart';
import { findUnit } from './products-client';
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

export type TrackEvent = 'pageViewed' | 'addToCart' | 'removeFromCart' | 'purchase';

/** The request each call sends, as the browser's network tab shows it (host p2.fwpixel.com). */
export const trackRequest: Record<TrackEvent, string> = {
  pageViewed: 'user:page_viewed',
  addToCart: 'user:add_to_cart',
  removeFromCart: 'user:remove_from_cart',
  purchase: 'user:purchase',
};

export interface LineItem {
  sku: string;
  quantity: number;
  price: number;
  product_name?: string;
}

/** Payload of addToCart, removeFromCart and purchase. The docs give all three the purchase format. */
export interface CommercePayload {
  order_id: string;
  currency: string;
  subtotal: number;
  order_value: number;
  line_items: LineItem[];
}

export interface PageViewedPayload {
  ext_customer_identifier?: string;
}

type PayloadFor<E extends TrackEvent> = E extends 'pageViewed' ? PageViewedPayload : CommercePayload;

export interface TrackResult<P = unknown> {
  status: 'sent' | 'skipped' | 'unavailable';
  reason: string;
  payload: P;
}

export interface TrackingLogEntry extends TrackResult {
  id: number;
  /** ISO time. */
  at: string;
  page: string;
  event: TrackEvent;
  /** For bag changes: the site's own buttons, or Add to Bag in the player. */
  source?: 'site' | 'player';
}

export interface TrackingStatus {
  on: boolean;
  reason: string;
}

const WAIT_MS = 12000;
const LOG_KEY = 'fjb.tracking.v1';
const LOG_MAX = 40;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function trackingStatus(settings: EffectiveSettings): TrackingStatus {
  if (!firework.trackEvents) return { on: false, reason: 'tracking is switched off in src/site.config.ts' };
  if (settings.fwMode === 'off') return { on: false, reason: 'the Firework SDK is switched off on this page (?fw=off)' };
  if (!settings.isSandbox) {
    const reason = settings.channel
      ? `channel "${settings.channel}" is not the sandbox channel, so nothing is sent to its analytics`
      : 'no sandbox channel is configured yet in src/site.config.ts';
    return { on: false, reason };
  }
  return { on: true, reason: "page views, bag changes and purchases go to the sandbox channel's analytics" };
}

// ---------- log of what this tab sent, kept for the tab so /lab/tracking can show events from other pages ----------

const listeners = new Set<(entry: TrackingLogEntry) => void>();

export function getTrackingLog(): TrackingLogEntry[] {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(LOG_KEY) ?? '[]') as TrackingLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function onTrackingLog(fn: (entry: TrackingLogEntry) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearTrackingLog(): void {
  try {
    window.sessionStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}

function record(event: TrackEvent, result: TrackResult, source?: TrackingLogEntry['source']): void {
  const log = getTrackingLog();
  const entry: TrackingLogEntry = { id: (log.at(-1)?.id ?? 0) + 1, at: new Date().toISOString(), page: location.pathname, event, source, ...result };
  log.push(entry);
  try {
    window.sessionStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-LOG_MAX)));
  } catch {
    /* storage blocked: the log only lasts for this page */
  }
  listeners.forEach((fn) => fn(entry));
}

// ---------- sending ----------

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

async function send<E extends TrackEvent>(
  event: E,
  payload: PayloadFor<E>,
  settings: EffectiveSettings,
  source?: TrackingLogEntry['source'],
): Promise<TrackResult<PayloadFor<E>>> {
  const status = trackingStatus(settings);
  if (!status.on) return { status: 'skipped', reason: status.reason, payload };
  const analytics = await waitFor(() => (window._fwn?.analytics?.[event] ? window._fwn.analytics : undefined), WAIT_MS);
  let result: TrackResult<PayloadFor<E>>;
  if (!analytics) {
    result = { status: 'unavailable', reason: `window._fwn.analytics.${event} was not available within ${WAIT_MS / 1000} seconds`, payload };
  } else {
    try {
      // A method call: the SDK's analytics methods need their object as `this`.
      (analytics[event] as (this: FwAnalytics, payload: object) => void).call(analytics, payload);
      result = { status: 'sent', reason: `sent with window._fwn.analytics.${event}(); look for ${trackRequest[event]} in the network tab`, payload };
    } catch (e) {
      result = { status: 'unavailable', reason: `window._fwn.analytics.${event}() threw: ${e instanceof Error ? e.message : String(e)}`, payload };
    }
  }
  record(event, result, source);
  return result;
}

// ---------- purchase ----------

export function purchasePayload(order: DemoOrder): CommercePayload {
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

export function trackPurchase(order: DemoOrder, settings: EffectiveSettings): Promise<TrackResult<CommercePayload>> {
  return send('purchase', purchasePayload(order), settings);
}

// ---------- bag changes ----------

export interface CartDelta {
  unitId: string;
  quantity: number;
}

/** What one change did to each unit in the bag. */
export function cartDeltas(previous: CartLine[], lines: CartLine[]): { added: CartDelta[]; removed: CartDelta[] } {
  const before = new Map(previous.map((l) => [l.unitId, l.quantity]));
  const after = new Map(lines.map((l) => [l.unitId, l.quantity]));
  const added: CartDelta[] = [];
  const removed: CartDelta[] = [];
  for (const unitId of new Set([...before.keys(), ...after.keys()])) {
    const change = (after.get(unitId) ?? 0) - (before.get(unitId) ?? 0);
    if (change > 0) added.push({ unitId, quantity: change });
    if (change < 0) removed.push({ unitId, quantity: -change });
  }
  return { added, removed };
}

/**
 * The docs give cart events the purchase format but don't say what goes in it. Like Google Analytics' add_to_cart,
 * which Firework's own dataLayer bridge forwards to the same calls, line_items holds what was added or removed and
 * the totals are its value. There is no order yet, so order_id is the bag's ID, which becomes the order ID.
 */
async function bagPayload(orderId: string, deltas: CartDelta[]): Promise<CommercePayload> {
  const line_items: LineItem[] = [];
  for (const d of deltas) {
    const found = await findUnit(d.unitId);
    if (found) line_items.push({ sku: d.unitId, quantity: d.quantity, price: found.unit.price, product_name: `${found.product.name} (${found.unit.name})` });
  }
  const value = round2(line_items.reduce((sum, l) => sum + l.price * l.quantity, 0));
  return { order_id: orderId, currency: 'EUR', subtotal: value, order_value: value, line_items };
}

/**
 * Sends addToCart or removeFromCart for one change to the bag, whether the site or Add to Bag in the player made
 * it. The player's own commerce:click_* events report the tap, not what the store's cart accepted.
 */
export async function trackCartChange(change: CartChange, settings: EffectiveSettings): Promise<void> {
  // Checkout empties the bag. Those items were bought, not removed, and the purchase event reports them.
  if (change.source === 'order') return;
  const source = change.source;
  const { added, removed } = cartDeltas(change.previous, change.lines);
  for (const [event, deltas] of [['addToCart', added], ['removeFromCart', removed]] as const) {
    if (deltas.length === 0) continue;
    try {
      const payload = await bagPayload(change.cartId, deltas);
      if (payload.line_items.length) await send(event, payload, settings, source);
    } catch (e) {
      const reason = `the store's product API failed, so the bag change could not be priced: ${e instanceof Error ? e.message : String(e)}`;
      record(event, { status: 'unavailable', reason, payload: deltas }, source);
    }
  }
}

// ---------- page setup ----------

/** Runs on every page from boot.ts: one pageViewed, then an event for each change to the bag. */
export function initTracking(settings: EffectiveSettings): void {
  const status = trackingStatus(settings);
  window.__fjb = { ...(window.__fjb ?? {}), tracking: { status } };
  if (!status.on) return;
  // This store has no customer accounts, so there is no ext_customer_identifier to send.
  void send('pageViewed', {}, settings);
  onCartWrite((change) => void trackCartChange(change, settings));
}
