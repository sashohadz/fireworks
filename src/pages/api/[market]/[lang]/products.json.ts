import type { APIRoute, GetStaticPaths } from 'astro';
import { products, toApiProduct } from '../../../../lib/catalog';
import { getMarket, markets, soldIn, type MarketId, type TextLanguage } from '../../../../lib/markets';

// Only the languages each market offers, e.g. /api/ch/fr/products.json but not /api/de/fr/products.json.
export const getStaticPaths: GetStaticPaths = () => markets.flatMap((m) => m.languages.map((lang) => ({ params: { market: m.id, lang } })));

// Mock commerce API for one market in one language: that market's prices and currency, the products it sells, and
// their name, subtitle and summary in the language. /api/{market}/products.json is the same in English.
export const GET: APIRoute = ({ params, site }) => {
  const market = getMarket(params.market as MarketId);
  const lang = params.lang as TextLanguage;
  return new Response(
    JSON.stringify(
      {
        market: market.id,
        currency: market.currency,
        language: lang,
        products: products.filter((p) => soldIn(p.id, market)).map((p) => toApiProduct(p, site, market, lang)),
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
};
