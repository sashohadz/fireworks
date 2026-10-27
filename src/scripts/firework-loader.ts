// Applies demo overrides to the Firework widgets on the page, then loads the Firework SDK once.
// Widgets are rendered by src/components/FwWidget.astro with data-fw-managed. When no channel is
// configured they render as placeholders and are turned into real elements here if a channel is set.
import { firework } from '../site.config';
import { playlistFor, type EffectiveSettings } from './settings';

const MANAGED = '[data-fw-managed]';

function desiredAttributes(el: HTMLElement, settings: EffectiveSettings): { channel: string; playlist: string | null } {
  const usePlaylist = el.dataset.fwUsePlaylist !== 'false';
  return {
    channel: settings.channel,
    playlist: usePlaylist ? playlistFor(settings, el.dataset.fwSlot) : null,
  };
}

function applyToElement(el: HTMLElement, settings: EffectiveSettings): void {
  const { channel, playlist } = desiredAttributes(el, settings);
  if (channel && el.getAttribute('channel') !== channel) el.setAttribute('channel', channel);
  if (playlist === null) return;
  if (playlist) el.setAttribute('playlist', playlist);
  else el.removeAttribute('playlist');
}

function materialise(placeholder: HTMLElement, settings: EffectiveSettings): HTMLElement | null {
  const tag = placeholder.dataset.fwTag;
  if (!tag || !settings.channel) return null;
  const el = document.createElement(tag);
  const attrs = JSON.parse(placeholder.dataset.fwAttrs ?? '{}') as Record<string, string>;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  for (const key of ['fwSlot', 'fwUsePlaylist', 'fwManaged'] as const) {
    if (placeholder.dataset[key] !== undefined) el.dataset[key] = placeholder.dataset[key];
  }
  if (placeholder.getAttribute('style')) el.setAttribute('style', placeholder.getAttribute('style')!);
  const classes = [...placeholder.classList].filter((c) => c !== 'fw-placeholder');
  if (classes.length) el.className = classes.join(' ');
  applyToElement(el, settings);
  placeholder.replaceWith(el);
  return el;
}

export function applyOverrides(settings: EffectiveSettings): void {
  document.querySelectorAll<HTMLElement>(MANAGED).forEach((el) => {
    if (el.dataset.fwTag) materialise(el, settings);
    else applyToElement(el, settings);
  });
}

export function loadFireworkSdk(settings: EffectiveSettings): void {
  document.documentElement.dataset.fw = settings.fwMode;
  if (settings.fwMode === 'off') return;
  if (document.querySelector('script[data-fw-sdk]')) return;
  const add = (src: string, attrs: Record<string, string>) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.fwSdk = 'true';
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    document.head.appendChild(s);
  };
  if (settings.fwMode === 'lazy') {
    add(firework.scripts.lazy, {});
    return;
  }
  add(firework.scripts.module, { type: 'module' });
  add(firework.scripts.nomodule, { nomodule: '' });
}
