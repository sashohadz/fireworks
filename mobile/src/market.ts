/**
 * The shopper's country: which price list and currency the store's API answers in (/api/{market}/…), and so what
 * Firework's player shows after hydration. Firework's own catalog stays in EUR. The same markets as the website
 * (src/lib/markets.ts in the repo root); keep them in step.
 */
export type MarketId = 'de' | 'ch' | 'pl';

export interface Market {
  id: MarketId;
  country: string;
  /** ISO 4217. */
  currency: string;
  label: string;
  /** Products this market doesn't sell: hydrated as hidden, so they disappear from the videos. */
  notSold: string[];
}

export const MARKETS: Market[] = [
  { id: 'de', country: 'Germany', currency: 'EUR', label: 'DE · EUR', notSold: [] },
  { id: 'ch', country: 'Switzerland', currency: 'CHF', label: 'CH · CHF', notSold: ['FJB-107'] },
  { id: 'pl', country: 'Poland', currency: 'PLN', label: 'PL · PLN', notSold: [] },
];

let current: Market = MARKETS[0]!;
const listeners = new Set<(m: Market) => void>();

export const getMarket = () => current;

export function setMarket(id: MarketId) {
  const next = MARKETS.find((m) => m.id === id);
  if (!next || next.id === current.id) { return; }
  current = next;
  listeners.forEach((l) => l(next));
}

export function onMarketChange(l: (m: Market) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** An amount in the given currency (default: the current market's), e.g. €24.00, CHF 26.90, PLN 103.99. */
export function formatMoney(amount: number, currency: string = current.currency): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount);
}
