/**
 * Countries the demo store sells in, each with its own currency and price list. Firework's catalog stays in EUR (one
 * business store, fed by the product feeds); the shop's own API answers in the shopper's market, and hydration passes
 * that price and currency to the player. Pure data and functions: safe for build-time code and the browser.
 */
export type MarketId = 'de' | 'ch' | 'pl';

/**
 * Languages the shop's product text comes in. English is the catalog's own text, the one Firework's catalog holds;
 * the others come from content/catalog/translations.json through /api/{market}/{lang}/…. The country picks the price
 * list, the language picks the text: Switzerland has one CHF price list in German and French.
 */
export const TEXT_LANGUAGES = ['de', 'fr', 'pl'] as const;
export type TextLanguage = (typeof TEXT_LANGUAGES)[number];
export type Language = 'en' | TextLanguage;
export const DEFAULT_LANGUAGE: Language = 'en';

/** Each language named in itself, for switches. */
export const languageNames: Record<Language, string> = { en: 'English', de: 'Deutsch', fr: 'Français', pl: 'Polski' };

export const isLanguage = (value: unknown): value is Language => typeof value === 'string' && value in languageNames;

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
  /** Languages the shop's product text comes in here, besides the catalog's English. */
  languages: TextLanguage[];
}

export const markets: Market[] = [
  { id: 'de', country: 'Germany', currency: 'EUR', label: 'DE · EUR', factor: 1, ending: null, notSold: [], languages: ['de'] },
  // A Swiss price list about 10% above the euro price, ending in .90. The SPF isn't in the Swiss range: it's tagged in
  // the morning-ritual video and has its own, so the demo shows what happens to a product a country doesn't sell.
  { id: 'ch', country: 'Switzerland', currency: 'CHF', label: 'CH · CHF', factor: 1.1, ending: 0.9, notSold: ['FJB-107'], languages: ['de', 'fr'] },
  // A Polish price list in złoty, ending in .99.
  { id: 'pl', country: 'Poland', currency: 'PLN', label: 'PL · PLN', factor: 4.3, ending: 0.99, notSold: [], languages: ['pl'] },
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

/** The languages a shopper in this market can pick: the catalog's English, then the market's own. */
export const marketLanguages = (market: Market): Language[] => ['en', ...market.languages];

export const offersLanguage = (market: Market, lang: Language): boolean => marketLanguages(market).includes(lang);

/** Prices for the shop's pages: English formatting, the market's currency. */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount);
}
