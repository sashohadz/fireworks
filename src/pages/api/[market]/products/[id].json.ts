import type { APIRoute, GetStaticPaths } from 'astro';
import { getProduct, products, toApiProduct } from '../../../../lib/catalog';
import { getMarket, markets, soldIn, type MarketId } from '../../../../lib/markets';

// Only products the market sells get a page; any other ID answers 404, like a real API for a product not sold there.
export const getStaticPaths: GetStaticPaths = () =>
  markets.flatMap((m) => products.filter((p) => soldIn(p.id, m)).map((p) => ({ params: { market: m.id, id: p.id } })));

// One product in one market, e.g. /api/ch/products/FJB-103.json.
export const GET: APIRoute = ({ params, site }) => {
  const product = getProduct(params.id ?? '');
  const market = getMarket(params.market as MarketId);
  if (!product || !soldIn(product.id, market)) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  return new Response(JSON.stringify(toApiProduct(product, site, market), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
