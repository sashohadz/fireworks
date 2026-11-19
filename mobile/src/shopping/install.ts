/**
 * Connects hydration to the Firework SDK. Called once from index.js, right after markInitCalled(), so the callback is
 * in place before any feed loads.
 */
import FireworkSDK, { type Product } from 'react-native-firework-sdk';
import { resolveProducts } from './hydration';
import { addLog } from './log';
import { getMode, modeLabel } from './modes';

const money = (p: Product) => {
  const u = p.units?.[0];
  if (!u?.price) { return ''; }
  const now = `€${u.price.amount.toFixed(2)}`;
  const was = u.originalPrice && u.originalPrice.amount > u.price.amount ? ` (was €${u.originalPrice.amount.toFixed(2)})` : '';
  return `${now}${was}${p.isAvailable === false ? ', sold out' : ''}`;
};

export function installHydration() {
  FireworkSDK.getInstance().shopping.onUpdateProductDetails = async (event) => {
    const mode = getMode();
    const t0 = Date.now();
    const base = { at: new Date(), mode: modeLabel(mode), asked: event.productIds, video: event.video?.caption ?? event.video?.videoId };
    try {
      const { products, lookup, via } = await resolveProducts(event.productIds, mode);
      const found = products.map((p) => ({ id: p.productId, summary: `${p.name ?? p.productId}: ${money(p)}` }));
      addLog({ ...base, via, found, unknown: lookup.unknown, ms: Date.now() - t0 });
      // Also in adb logcat (tag ReactNativeJS), to follow along from a computer.
      console.log(`[hydration] ${via} · asked ${event.productIds.join(', ')} · ${found.map((f) => `${f.id} ${f.summary}`).join(' | ') || 'none found'} · ${Date.now() - t0} ms`);
      return products;
    } catch (e) {
      addLog({ ...base, found: [], unknown: [], ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
      console.log(`[hydration] ${modeLabel(mode)} · asked ${event.productIds.join(', ')} · threw: ${e instanceof Error ? e.message : String(e)}`);
      // Rethrown on purpose: this is what a broken integration does, and Failing mode shows what the player does then.
      throw e;
    }
  };
}
