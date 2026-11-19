/** Which tab is open, as a tiny store, so SDK callbacks (the player's cart icon) can open the Cart tab. */
export type Tab = 'feed' | 'storyblock' | 'cart';

let tab: Tab = 'feed';
const listeners = new Set<(t: Tab) => void>();

export const getTab = () => tab;

export function openTab(t: Tab) {
  tab = t;
  listeners.forEach((l) => l(t));
}

export function onTab(l: (t: Tab) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
