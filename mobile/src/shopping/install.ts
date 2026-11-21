/**
 * Connects hydration to the Firework SDK. Called once from index.js, right after markInitCalled(), so the callback is
 * in place before any feed loads.
 */
import FireworkSDK, { type Product } from 'react-native-firework-sdk';
import { resolveProducts } from './hydration';
import { addLog } from './log';
import { getMode, modeLabel } from './modes';
import { formatMoney } from '../market';

const money = (p: Product) => {
  const u = p.units?.[0];
  if (!u?.price) { return ''; }
  const now = formatMoney(u.price.amount, u.price.currencyCode);
  const was = u.originalPrice && u.originalPrice.amount > u.price.amount ? ` (was ${formatMoney(u.originalPrice.amount, u.originalPrice.currencyCode)})` : '';
  return `${now}${was}${p.isAvailable === false ? ', sold out' : ''}`;
};

export function installHydration() {
  FireworkSDK.getInstance().shopping.onUpdateProductDetails = async (event) => {
    const mode = getMode();
    const t0 = Date.now();
    const base = {
      at: new Date(),
      kind: 'hydration' as const,
      video: event.video?.caption ?? event.video?.videoId,
      request: `Firework asked for: ${event.productIds.join(', ') || '(nothing)'}`,
    };
    try {
      const { products, lookup, via } = await resolveProducts(event.productIds, mode);
      addLog({
        ...base,
        title: via === modeLabel(mode) ? via : `${modeLabel(mode)} · ${via}`,
        ms: Date.now() - t0,
        lines: products.map((p) => ({ ok: true, text: p.hidden ? `${p.productId}: hidden (not sold in this country)` : `${p.productId} ${p.name ?? ''}: ${money(p)}` })),
        note: lookup.unknown.length ? `Not in the store’s catalog (Firework’s data kept): ${lookup.unknown.join(', ')}` : undefined,
      });
      return products;
    } catch (e) {
      addLog({ ...base, title: modeLabel(mode), ms: Date.now() - t0, lines: [{ ok: false, text: e instanceof Error ? e.message : String(e) }] });
      // Rethrown on purpose: this is what a broken integration does, and Failing mode shows what the player does then.
      throw e;
    }
  };
}
