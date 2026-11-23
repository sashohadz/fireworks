import type { APIRoute, GetStaticPaths } from 'astro';
import { products, toApiProduct } from '../../../lib/catalog';
import { getMarket, markets, soldIn, type MarketId } from '../../../lib/markets';

export const getStaticPaths: GetStaticPaths = () => markets.map((m) => ({ params: { market: m.id } }));

// Mock commerce API for one market, e.g. /api/ch/products.json: that market's prices and currency, and only the
// products it sells.
export const GET: APIRoute = ({ params, site }) => {
  const market = getMarket(params.market as MarketId);
  return new Response(
    JSON.stringify(
      { market: market.id, currency: market.currency, products: products.filter((p) => soldIn(p.id, market)).map((p) => toApiProduct(p, site, market)) },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
};
