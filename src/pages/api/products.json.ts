import type { APIRoute } from 'astro';
import { catalog, products, toApiProduct } from '../../lib/catalog';

// Mock commerce API: the "merchant backend" that product hydration and the cart read from.
export const GET: APIRoute = ({ site }) =>
  new Response(
    JSON.stringify({ currency: catalog.currency, products: products.map((p) => toApiProduct(p, site)) }, null, 2),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
