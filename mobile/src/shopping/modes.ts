/**
 * The demo switch: where hydration gets its data, and what it does to it. Like the website's ?shopping= switches
 * (src/lab/shopping.ts in the repo root). A tiny store, so the Settings sheet and the hydration callback agree.
 */
export type Mode = 'live' | 'hardcoded' | 'sale' | 'soldout' | 'failing';

export const MODES: { id: Mode; label: string; detail: string }[] = [
  { id: 'live', label: 'Live API', detail: 'Prices and stock from the store’s mock API. The country’s price list loads at start and on a country change, and is kept 5 minutes, so Firework gets its answer at once.' },
  { id: 'hardcoded', label: 'Hardcoded', detail: 'The same catalog bundled with the app. Works offline.' },
  { id: 'sale', label: '−20% sale', detail: 'Live prices × 0.8, with the real price struck through: proof that the price comes from the app.' },
  { id: 'soldout', label: 'Sold out', detail: 'Every unit unavailable, so the player can’t sell it.' },
  { id: 'failing', label: 'Failing', detail: 'The callback throws. Firework keeps its own stored product data.' },
];

let current: Mode = 'live';
const listeners = new Set<(m: Mode) => void>();

export const getMode = () => current;

export function setMode(m: Mode) {
  current = m;
  listeners.forEach((l) => l(m));
}

export function onModeChange(l: (m: Mode) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const modeLabel = (m: Mode) => MODES.find((x) => x.id === m)?.label ?? m;
