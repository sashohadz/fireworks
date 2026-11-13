// Applies demo overrides to the Firework widgets on the page, then loads the Firework SDK once.
// Widgets are rendered by src/components/FwWidget.astro with data-fw-managed. When no channel is
// configured they render as placeholders and are turned into real elements here if a channel is set.
import { ava, firework } from '../site.config';
import { playlistFor, type EffectiveSettings } from './settings';
import { trackingStatus } from './tracking';

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
  for (const key of ['fwSlot', 'fwKey', 'fwUsePlaylist', 'fwManaged'] as const) {
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
    // No widget, so no space to keep for it.
    el.closest<HTMLElement>('.fw-reserve')?.style.removeProperty('--fw-reserve');
    const note = document.createElement('p');
    note.className = 'fw-failed-note';
    note.textContent = `Firework returned no videos for ${describeSource(el)}, so this widget is hidden.`;
    el.after(note);
  });
}

/** With ?widgets=, a widget stays only if its key (or slot) is listed. The lab measures setups this way. */
function keptByWidgetList(el: HTMLElement, settings: EffectiveSettings): boolean {
  if (!settings.widgets) return true;
  const key = el.dataset.fwKey ?? el.dataset.fwSlot ?? '';
  return (settings.widgets as string[]).includes(key);
}

export function applyOverrides(settings: EffectiveSettings): void {
  document.querySelectorAll<HTMLElement>(MANAGED).forEach((el) => {
    if (!keptByWidgetList(el, settings)) {
      // Its reserved space goes with it. Base.astro already hid both before first paint.
      (el.parentElement?.classList.contains('fw-reserve') ? el.parentElement : el).remove();
      return;
    }
    if (el.dataset.fwDefer === 'true') return;
    const live = el.dataset.fwTag ? materialise(el, settings) : el;
    if (!live) return;
    applyToElement(live, settings);
    hideWhenFeedFails(live);
  });
}

/** Turns a deferred placeholder (FwWidget with defer) into the real widget. The loaded SDK upgrades it. */
export function materialiseDeferred(placeholder: HTMLElement, settings: EffectiveSettings): HTMLElement | null {
  const live = materialise(placeholder, settings);
  if (live) hideWhenFeedFails(live);
  return live;
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
  // The store says "bag", so every widget on the sandbox says Add to Bag and shows a bag icon. Firework's SDK
  // recommends shopping_cart_style over configureCart's deprecated addToCartText; data-fwparam_ sets it for all widgets.
  const bagStyle: Record<string, string> = settings.isSandbox ? { 'data-fwparam_shopping_cart_style': 'bag' } : {};
  const add = (src: string, attrs: Record<string, string>) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.fwSdk = 'true';
    for (const [k, v] of Object.entries({ ...attrs, ...limitTracking, ...bagStyle })) s.setAttribute(k, v);
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
 * Firework's analytics script, in the head of every page that sends tracking events, as the tracking docs ask.
 * The full SDK bundles the same code, but fwn-async.js only loads the SDK once a widget scrolls into view, so a
 * page without widgets, such as the order confirmation page, has no window._fwn.analytics without this tag.
 * Both can be on one page: whichever loads first defines window._fwn.analytics and the other leaves it alone.
 */
export function loadAnalyticsScript(settings: EffectiveSettings): void {
  if (!trackingStatus(settings).on || document.querySelector('script[data-fw-analytics]')) return;
  const s = document.createElement('script');
  s.src = firework.scripts.analytics;
  s.async = true;
  s.dataset.fwAnalytics = 'true';
  document.head.appendChild(s);
}

/**
 * AVA has its own script. It also creates window._fwn, so ?fw=off skips it just like the video SDK.
 * It only loads on pages that have an <fw-ava> element.
 */
export function loadAvaScript(settings: EffectiveSettings): void {
  if (settings.widgets && !(settings.widgets as string[]).includes('ava')) {
    document.querySelectorAll('fw-ava').forEach((el) => el.remove());
    return;
  }
  if (settings.fwMode === 'off' || !ava.assistantId) return;
  if (!document.querySelector('fw-ava') || document.querySelector('script[data-ava-sdk]')) return;
  const s = document.createElement('script');
  s.src = `${ava.script}?business_id=${encodeURIComponent(ava.businessId)}`;
  s.async = true;
  s.dataset.avaSdk = 'true';
  document.head.appendChild(s);
}
