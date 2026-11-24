import type { APIRoute, GetStaticPaths } from 'astro';
import { getProduct, products, toApiProduct } from '../../../../../lib/catalog';
import { getMarket, markets, offersLanguage, soldIn, type MarketId, type TextLanguage } from '../../../../../lib/markets';

// Products the market sells, in the languages it offers. Anything else answers 404 (a static host serves its 404).
export const getStaticPaths: GetStaticPaths = () =>
  markets.flatMap((m) =>
    m.languages.flatMap((lang) => products.filter((p) => soldIn(p.id, m)).map((p) => ({ params: { market: m.id, lang, id: p.id } }))),
  );

// One product in one market and language, e.g. /api/ch/fr/products/FJB-103.json: CHF prices, French text.
export const GET: APIRoute = ({ params, site }) => {
  const product = getProduct(params.id ?? '');
  const market = getMarket(params.market as MarketId);
  const lang = params.lang as TextLanguage;
  if (!product || !soldIn(product.id, market) || !offersLanguage(market, lang)) {
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  }
  return new Response(JSON.stringify(toApiProduct(product, site, market, lang), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
