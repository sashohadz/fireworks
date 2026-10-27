import type { APIRoute } from 'astro';
import { fireworkCsv } from '../../lib/feeds';

// Download and upload in Business Portal's CSV batch import.
export const GET: APIRoute = ({ site }) =>
  new Response(fireworkCsv(site), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
