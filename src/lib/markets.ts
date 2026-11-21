/**
 * Countries the demo store sells in, each with its own currency and price list. Firework's catalog stays in EUR (one
 * business store, fed by the product feeds); the shop's own API answers in the shopper's market, and hydration passes
 * that price and currency to the player. Pure data and functions: safe for build-time code and the browser.
 */
export type MarketId = 'de' | 'ch' | 'pl';

export interface Market {
  id: MarketId;
  country: string;
  /** ISO 4217. */
  currency: string;
  /** Short label for switches, e.g. "CH · CHF". */
  label: string;
  /** Price list: euro price × factor, then rounded to the market's usual price ending. */
  factor: number;
  /** Cents a price ends in, e.g. 0.9 for 26.90, 0.99 for 103.99. Null keeps the euro price as it is. */
  ending: number | null;
  /** Products this market doesn't sell: its API answers 404 for them. */
  notSold: string[];
}

export const markets: Market[] = [
  { id: 'de', country: 'Germany', currency: 'EUR', label: 'DE · EUR', factor: 1, ending: null, notSold: [] },
  // A Swiss price list about 10% above the euro price, ending in .90; the gift set isn't sold in Switzerland.
  { id: 'ch', country: 'Switzerland', currency: 'CHF', label: 'CH · CHF', factor: 1.1, ending: 0.9, notSold: ['FJB-112'] },
  // A Polish price list in złoty, ending in .99.
  { id: 'pl', country: 'Poland', currency: 'PLN', label: 'PL · PLN', factor: 4.3, ending: 0.99, notSold: [] },
];

export const DEFAULT_MARKET: MarketId = 'de';

export const isMarketId = (value: unknown): value is MarketId => markets.some((m) => m.id === value);

export const getMarket = (id: MarketId): Market => markets.find((m) => m.id === id) ?? markets[0]!;

/** The market's price for a euro price, e.g. 24 → CHF 26.90 → PLN 103.99. */
export function marketPrice(eur: number, market: Market): number {
  // In whole cents: 29 × 1.1 is 31.900000000000002 in floating point, which would round up to the next price ending.
  const raw = Math.round(eur * market.factor * 100);
  if (market.ending === null) return raw / 100;
  const ending = Math.round(market.ending * 100);
  return (Math.ceil((raw - ending) / 100) * 100 + ending) / 100;
}

export const soldIn = (productId: string, market: Market): boolean => !market.notSold.includes(productId);

/** Prices for the shop's pages: English formatting, the market's currency. */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount);
}
