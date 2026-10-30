// Custom arrow designs for Firework's ui_asset_next and ui_asset_previous attributes.
// Each style is drawn once, pointing right, on a 24x24 grid. src/pages/arrows/[file].svg.ts publishes it as
// /arrows/<id>-next.svg and a mirrored /arrows/<id>-previous.svg. Safe to import from client code.
//
// Firework injects the SVG markup into the widget, so "theme" styles use currentColor and follow the widget's
// colours, while "fixed" styles keep their own. https://docs.firework.com/firework-for-developers/web/integration-guide/player/player-attributes/appearance-configuration

export interface ArrowStyle {
  id: string;
  name: string;
  description: string;
  colour: 'theme' | 'fixed';
  /** Inner SVG markup for the "next" direction, 24x24 viewBox. */
  body: string;
}

const line = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const arrowStyles: ArrowStyle[] = [
  {
    id: 'chevron',
    name: 'Chevron',
    description: 'A thin, quiet chevron that takes the widget colour.',
    colour: 'theme',
    body: `<path d="M9 5l7 7-7 7" ${line}/>`,
  },
  {
    id: 'long-arrow',
    name: 'Long arrow',
    description: 'An editorial line arrow, common on fashion and beauty sites.',
    colour: 'theme',
    body: `<path d="M3.5 12h16M14 6l6 6-6 6" ${line}/>`,
  },
  {
    id: 'bold-triangle',
    name: 'Bold triangle',
    description: 'A solid, rounded triangle that reads well on small screens.',
    colour: 'theme',
    body: '<path d="M8 5.6v12.8a1.1 1.1 0 0 0 1.7.93l10-6.4a1.1 1.1 0 0 0 0-1.86l-10-6.4A1.1 1.1 0 0 0 8 5.6z" fill="currentColor"/>',
  },
  {
    id: 'sketch',
    name: 'Hand-drawn',
    description: 'A loose, hand-drawn stroke for playful brands.',
    colour: 'theme',
    body: `<path d="M3.5 12.7c3.3-.6 7.7-1 14.6-.5M13.4 6.2c1.5 2 3.5 4 6 5.7-2.3 1.6-4.3 3.7-6.2 6" ${line}/>`,
  },
  {
    id: 'fjord-circle',
    name: 'Fjord disc',
    description: 'Brand colours baked in: a fjord-blue disc with a white chevron.',
    colour: 'fixed',
    body: '<circle cx="12" cy="12" r="11" fill="#2F5D73"/><path d="M10.2 7l5 5-5 5" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    id: 'cloudberry',
    name: 'Cloudberry tile',
    description: 'A cloudberry-orange tile with a dark arrow, for a bolder brand accent.',
    colour: 'fixed',
    body: '<rect x="1" y="1" width="22" height="22" rx="7" fill="#E8913A"/><path d="M6 12h10.5M12.3 7.6l4.4 4.4-4.4 4.4" fill="none" stroke="#14212B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
];

export type ArrowDirection = 'next' | 'previous';

export const arrowPath = (id: string, direction: ArrowDirection) => `/arrows/${id}-${direction}.svg`;

/** Lab links may only point ui_asset_* at these files, never at another host. */
export const ARROW_FILE = /^\/arrows\/([a-z0-9-]+)-(next|previous)\.svg$/;

export function arrowSvg(style: ArrowStyle, direction: ArrowDirection): string {
  const body = direction === 'previous' ? `<g transform="matrix(-1 0 0 1 24 0)">${style.body}</g>` : style.body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" data-fjb-arrow="${style.id}-${direction}">${body}</svg>\n`;
}
