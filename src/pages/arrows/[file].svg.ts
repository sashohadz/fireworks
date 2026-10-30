// /arrows/<id>-next.svg and /arrows/<id>-previous.svg for every style in src/lab/arrows.ts.
// Served with CORS (netlify.toml), so they also work as ui_asset_* values on other sites and in CodePen.
import type { APIRoute, GetStaticPaths } from 'astro';
import { arrowStyles, arrowSvg, type ArrowDirection } from '../../lab/arrows';

export const getStaticPaths = (() =>
  arrowStyles.flatMap((style) =>
    (['next', 'previous'] as ArrowDirection[]).map((direction) => ({
      params: { file: `${style.id}-${direction}` },
      props: { svg: arrowSvg(style, direction) },
    })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response((props as { svg: string }).svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
