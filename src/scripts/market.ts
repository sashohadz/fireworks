// The shopper's country: which price list and currency the store's API answers in (/api/{market}/…), and so what
// Firework's player shows after hydration. Firework's own catalog stays in EUR. Set with ?market=de|ch|pl (only
// those values) or the Country control on /lab/shopping. Like a real multi-country shop, each country has its own
// bag: switching empties it.
//
// The language is separate from the country (Switzerland: one CHF price list, German or French text). It only changes
// what goes to Firework's player: product text from /api/{market}/{lang}/… and the player's own buttons (the lang
// attribute on the widgets). The store's own pages stay English. Set with ?lang=en|de|fr|pl (only languages the
// country offers) or the Language control on /lab/shopping.
import {
  DEFAULT_LANGUAGE,
  DEFAULT_MARKET,
  formatMoney as format,
  getMarket,
  isLanguage,
  isMarketId,
  marketLanguages,
  marketPrice,
  markets,
  offersLanguage,
  soldIn,
  type Language,
  type Market,
  type MarketId,
} from '../lib/markets';
import { clearCart, getCart } from './cart';

const KEY = 'fjb.market.v1';
const LANGUAGE_KEY = 'fjb.language.v1';
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
  // A language the new country doesn't offer (French in Poland) goes back to the catalog's English.
  if (!offersLanguage(getMarket(id), currentLanguage())) setLanguage(DEFAULT_LANGUAGE);
  window.dispatchEvent(new CustomEvent(MARKET_EVENT, { detail: id }));
  return true;
}

/** The language of the product text sent to Firework: one the current country offers, otherwise English. */
export function currentLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (isLanguage(saved) && offersLanguage(currentMarket(), saved)) return saved;
  } catch {
    /* storage blocked: English */
  }
  return DEFAULT_LANGUAGE;
}

/** Switches language. Returns false when it was already that language or the country doesn't offer it. */
export function setLanguage(lang: Language): boolean {
  if (currentLanguage() === lang || !offersLanguage(currentMarket(), lang)) return false;
  try {
    if (lang === DEFAULT_LANGUAGE) window.localStorage.removeItem(LANGUAGE_KEY);
    else window.localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    /* storage blocked: the switch can't last beyond this page */
  }
  return true;
}

/** The languages the current country offers, English first. */
export const currentLanguages = (): Language[] => marketLanguages(currentMarket());

/** ?market=… sets the country. Anything but a known market ID is ignored. */
export function syncMarketFromUrl(search: string = location.search): void {
  const params = new URLSearchParams(search);
  const value = params.get('market');
  if (isMarketId(value)) setMarket(value);
  // ?lang=… after the country, so ?market=ch&lang=fr works. Anything the country doesn't offer is ignored.
  const lang = params.get('lang');
  if (isLanguage(lang)) setLanguage(lang);
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
