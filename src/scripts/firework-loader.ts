// Applies demo overrides to the Firework widgets on the page, then loads the Firework SDK once.
// Widgets are rendered by src/components/FwWidget.astro with data-fw-managed. When no channel is
// configured they render as placeholders and are turned into real elements here if a channel is set.
import { ava, firework } from '../site.config';
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

function describeSource(el: HTMLElement): string {
  for (const attr of ['skus', 'hashtag', 'playlist', 'video']) {
    const value = el.getAttribute(attr);
    if (value) return `${attr}="${value}"`;
  }
  return `channel="${el.getAttribute('channel') ?? ''}"`;
}

const watched = new WeakSet<HTMLElement>();

/**
 * A feed with no content, such as a skus Storyblock for a product without tagged videos, fires
 * fw:embed-feed:error and otherwise leaves an empty box at the widget's height. Customers usually
 * hide the container; here the widget is hidden and a note says which source returned nothing.
 */
function hideWhenFeedFails(el: HTMLElement): void {
  if (watched.has(el)) return;
  watched.add(el);
  el.addEventListener('fw:embed-feed:error', () => {
    if (el.classList.contains('fw-failed')) return;
    el.classList.add('fw-failed');
    const note = document.createElement('p');
    note.className = 'fw-failed-note';
    note.textContent = `Firework returned no videos for ${describeSource(el)}, so this widget is hidden.`;
    el.after(note);
  });
}

export function applyOverrides(settings: EffectiveSettings): void {
  document.querySelectorAll<HTMLElement>(MANAGED).forEach((el) => {
    const live = el.dataset.fwTag ? materialise(el, settings) : el;
    if (!live) return;
    applyToElement(live, settings);
    hideWhenFeedFails(live);
  });
}

export function loadFireworkSdk(settings: EffectiveSettings): void {
  document.documentElement.dataset.fw = settings.fwMode;
  if (settings.fwMode === 'off') return;
  if (document.querySelector('script[data-fw-sdk]')) return;
  // On someone else's channel (a teammate's sandbox or a customer repro), keep our visits out of their
  // Insights as far as the SDK allows: tracking opt-in without consent means only essential requests.
  // https://docs.firework.com/firework-for-developers/web/integration-guide/privacy-settings/privacy-settings
  const limitTracking: Record<string, string> =
    settings.channel && !settings.isSandbox ? { 'data-fwparam_tracking_opt_in': 'true' } : {};
  const add = (src: string, attrs: Record<string, string>) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.fwSdk = 'true';
    for (const [k, v] of Object.entries({ ...attrs, ...limitTracking })) s.setAttribute(k, v);
    document.head.appendChild(s);
  };
  if (settings.fwMode === 'lazy') {
    add(firework.scripts.lazy, {});
    return;
  }
  add(firework.scripts.module, { type: 'module' });
  add(firework.scripts.nomodule, { nomodule: '' });
}

/**
 * AVA has its own script. It also creates window._fwn, so ?fw=off skips it just like the video SDK.
 * It only loads on pages that have an <fw-ava> element.
 */
export function loadAvaScript(settings: EffectiveSettings): void {
  if (settings.fwMode === 'off' || !ava.assistantId) return;
  if (!document.querySelector('fw-ava') || document.querySelector('script[data-ava-sdk]')) return;
  const s = document.createElement('script');
  s.src = `${ava.script}?business_id=${encodeURIComponent(ava.businessId)}`;
  s.async = true;
  s.dataset.avaSdk = 'true';
  document.head.appendChild(s);
}
