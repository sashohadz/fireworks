// The shopper's country: which price list and currency the store's API answers in (/api/{market}/…), and so what
// Firework's player shows after hydration. Firework's own catalog stays in EUR. Set with ?market=de|ch|pl (only
// those values) or the Country control on /lab/shopping. Like a real multi-country shop, each country has its own
// bag: switching empties it.
import { DEFAULT_MARKET, formatMoney as format, getMarket, isMarketId, marketPrice, markets, soldIn, type Market, type MarketId } from '../lib/markets';
import { clearCart, getCart } from './cart';

const KEY = 'fjb.market.v1';
export const MARKET_EVENT = 'fjb:market-changed';

export function currentMarket(): Market {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (isMarketId(saved)) return getMarket(saved);
  } catch {
    /* storage blocked: the default market */
  }
  return getMarket(DEFAULT_MARKET);
}

/** Switches country. Returns false when it was already that country. Empties the bag (another country's shop). */
export function setMarket(id: MarketId): boolean {
  if (currentMarket().id === id) return false;
  try {
    if (id === DEFAULT_MARKET) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked: the switch can't last beyond this page */
  }
  if (getCart().length) clearCart('market');
  window.dispatchEvent(new CustomEvent(MARKET_EVENT, { detail: id }));
  return true;
}

/** ?market=… sets the country. Anything but a known market ID is ignored. */
export function syncMarketFromUrl(search: string = location.search): void {
  const value = new URLSearchParams(search).get('market');
  if (isMarketId(value)) setMarket(value);
}

/** An amount in the current market's currency, or in the one given (e.g. a saved order's). */
export const formatMoney = (amount: number, currency: string = currentMarket().currency): string => format(amount, currency);

/** A euro amount from the catalog or the store's rules (shipping), in the current market's price list. */
export const marketAmount = (eur: number): number => marketPrice(eur, currentMarket());

export const soldHere = (productId: string): boolean => soldIn(productId, currentMarket());

/**
 * Prices written into the page at build time are euros: re-price every element marked data-eur, and mark cards of
 * products this country doesn't sell (.product-card[data-product-id]). Nothing to do in the default market.
 */
export function repriceDocument(root: ParentNode = document): void {
  const market = currentMarket();
  if (market.id === DEFAULT_MARKET) return;
  root.querySelectorAll<HTMLElement>('[data-eur]').forEach((el) => {
    const eur = Number(el.dataset.eur);
    if (Number.isFinite(eur)) el.textContent = formatMoney(marketPrice(eur, market), market.currency);
  });
  root.querySelectorAll<HTMLElement>('.product-card[data-product-id]').forEach((el) => {
    if (soldIn(el.dataset.productId ?? '', market) || el.querySelector('.badge-not-sold')) return;
    const badge = document.createElement('span');
    badge.className = 'badge badge-out badge-not-sold';
    badge.textContent = `Not sold in ${market.country}`;
    (el.querySelector('.product-card-badges') ?? el).append(badge);
  });
}

export { markets };
