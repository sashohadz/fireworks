import type { APIRoute } from 'astro';
import { DEFAULT_MARKET, markets } from '../../lib/markets';

// The countries the mock commerce API sells in, with their currency: /api/{market}/products.json for each.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      { default: DEFAULT_MARKET, markets: markets.map(({ id, country, currency, label, notSold }) => ({ id, country, currency, label, notSold })) },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
