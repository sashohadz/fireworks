import type { APIRoute } from 'astro';
import { googleXmlFeed } from '../../lib/feeds';

// Paste this URL into Business Portal > Products > Import via Google XML, then enable auto-sync.
export const GET: APIRoute = ({ site }) =>
  new Response(googleXmlFeed(site), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
