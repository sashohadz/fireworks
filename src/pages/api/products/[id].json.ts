import type { APIRoute, GetStaticPaths } from 'astro';
import { getProduct, products, toApiProduct } from '../../../lib/catalog';

export const getStaticPaths: GetStaticPaths = () => products.map((p) => ({ params: { id: p.id } }));

// One product by external ID, e.g. /api/products/FJB-103.json
export const GET: APIRoute = ({ params, site }) => {
  const product = getProduct(params.id ?? '');
  if (!product) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  return new Response(JSON.stringify(toApiProduct(product, site), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
