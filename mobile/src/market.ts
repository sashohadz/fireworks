/**
 * The shopper's country: which price list and currency the store's API answers in (/api/{market}/…), and so what
 * Firework's player shows after hydration. Firework's own catalog stays in EUR. The same markets as the website
 * (src/lib/markets.ts in the repo root); keep them in step.
 */
export type MarketId = 'de' | 'ch' | 'pl';

/**
 * Languages of the product text. English is the catalog's own text (what Firework's catalog holds); the others come
 * from /api/{market}/{lang}/…. The country picks the price list, the language picks the text: Switzerland has one CHF
 * price list in German and French. Same as src/lib/markets.ts in the website.
 */
export type TextLanguage = 'de' | 'fr' | 'pl';
export type Language = 'en' | TextLanguage;
export const languageNames: Record<Language, string> = { en: 'English', de: 'Deutsch', fr: 'Français', pl: 'Polski' };

export interface Market {
  id: MarketId;
  country: string;
  /** ISO 4217. */
  currency: string;
  label: string;
  /** Products this market doesn't sell: hydrated as hidden, so they disappear from the videos. */
  notSold: string[];
  /** Languages the store's product text comes in here, besides the catalog's English. */
  languages: TextLanguage[];
}

export const MARKETS: Market[] = [
  { id: 'de', country: 'Germany', currency: 'EUR', label: 'DE · EUR', notSold: [], languages: ['de'] },
  { id: 'ch', country: 'Switzerland', currency: 'CHF', label: 'CH · CHF', notSold: ['FJB-107'], languages: ['de', 'fr'] },
  { id: 'pl', country: 'Poland', currency: 'PLN', label: 'PL · PLN', notSold: [], languages: ['pl'] },
];

let current: Market = MARKETS[0]!;
let language: Language = 'en';
const listeners = new Set<(m: Market) => void>();

export const getMarket = () => current;
export const getLanguage = () => language;

/** The languages a shopper in this market can pick: the catalog's English, then the market's own. */
export const marketLanguages = (m: Market = current): Language[] => ['en', ...m.languages];

export function setMarket(id: MarketId) {
  const next = MARKETS.find((m) => m.id === id);
  if (!next || next.id === current.id) { return; }
  current = next;
  // A language the new country doesn't offer (French in Poland) goes back to the catalog's English.
  if (!marketLanguages(next).includes(language)) { language = 'en'; }
  listeners.forEach((l) => l(next));
}

/** Switches the product text's language. Returns false when it was already that one or the country doesn't offer it. */
export function setLanguage(lang: Language): boolean {
  if (lang === language || !marketLanguages().includes(lang)) { return false; }
  language = lang;
  return true;
}

/**
 * Where the store's API answers for this market and language: 'ch' (English) or 'ch/fr', as in /api/ch/fr/products.json.
 * Also the key of the price lists in memory and of the bundled snapshot.
 */
export type CatalogKey = MarketId | `${MarketId}/${TextLanguage}`;
export const catalogKey = (market: MarketId = current.id, lang: Language = language): CatalogKey => (lang === 'en' ? market : `${market}/${lang}`);

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
