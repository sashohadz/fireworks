import type { APIRoute } from 'astro';
import { DEFAULT_MARKET, markets } from '../../lib/markets';

// The countries the mock commerce API sells in, with their currency and languages: /api/{market}/products.json in
// English for each, and /api/{market}/{lang}/products.json for each of the market's languages.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      { default: DEFAULT_MARKET, markets: markets.map(({ id, country, currency, label, notSold, languages }) => ({ id, country, currency, label, notSold, languages: ['en', ...languages] })) },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
