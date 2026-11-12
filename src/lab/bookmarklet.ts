// The "Your site with Firework" bookmarklet: adds Firework videos or AVA to any website, in the presenter's browser
// tab only. /lab/bookmarklet builds the bookmark from fjbInject's source text, with one setup baked in.
import type { PortalLayout } from './layouts';

/** One setup the bookmark adds: a video layout or an AVA embed. */
export interface InjectConfig {
  /** Name shown in the panel, such as "Carousel" or "AVA Native Button". */
  layout: string;
  /** Where its content comes from, for the panel: "channel / playlist" or "assistant …". */
  source: string;
  /** What is placed, in a sentence: "the videos" or "AVA". */
  what: string;
  tag: string;
  attrs: Record<string, string>;
  /** Inline style the element needs, such as the horizontal player's 16:9 box. */
  style: string;
  /** Floating layouts need no placement: they go straight into the corner. */
  floating: boolean;
  /** The script that defines the element, and how to tell the page already has it. */
  script: { src: string; module: boolean; present: string };
  /** Said when the element stays empty. */
  empty: string;
}

/** The only values the builder accepts, so the bookmark never carries anything else. */
export const CHANNEL_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
export const PLAYLIST_PATTERN = /^[A-Za-z0-9_-]{0,32}$/;
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
export const SKU_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/** AVA's two embeds, named as in AVA 4.0's Embed screen. */
export const avaEmbeds = [
  {
    id: 'ava_button',
    name: 'AVA Native Button',
    layout: 'button',
    summary: "AVA's button, with the label and colours set under Embed in Business Portal. It opens the chat. Needs no products, so it suits prospects.",
  },
  {
    id: 'ava_faq',
    name: 'AVA Product FAQ',
    layout: 'faq',
    summary: 'Starter questions about one product, answered by AVA. Only works with a product ID linked to the assistant.',
  },
] as const;

export type AvaEmbed = (typeof avaEmbeds)[number];

export function videoConfig(layout: PortalLayout, channel: string, playlist: string, sdk: string): InjectConfig {
  return {
    layout: layout.name,
    source: `${channel}${playlist ? ` / ${playlist}` : ''}`,
    what: 'the videos',
    tag: layout.tag,
    attrs: { channel, ...(playlist ? { playlist } : {}), ...layout.attrs },
    style: layout.style ?? '',
    floating: layout.attrs.mode === 'pinned',
    script: { src: sdk, module: true, present: 'script[src*="/fwn"]' },
    empty: `Firework returned no videos for ${playlist ? `playlist ${playlist}` : `channel ${channel}`}. Check the channel and playlist.`,
  };
}

export function avaConfig(embed: AvaEmbed, assistant: string, business: string, sku: string, script: string): InjectConfig {
  return {
    layout: embed.name,
    source: `assistant ${assistant}${embed.layout === 'faq' ? `, product ${sku}` : ''}`,
    what: 'AVA',
    tag: 'fw-ava',
    attrs: { domain_assistant_id: assistant, layout: embed.layout, ...(embed.layout === 'faq' ? { sku } : {}) },
    style: '',
    floating: false,
    script: { src: `${script}?business_id=${encodeURIComponent(business)}`, module: false, present: 'script[src*="/ava.js"]' },
    empty:
      embed.layout === 'faq'
        ? `AVA shows nothing for product ${sku}. Check that the assistant is published and that this product is linked to it.`
        : 'AVA shows nothing. Check the assistant ID and business ID, and that the assistant is published.',
  };
}

/**
 * Runs on someone else's page. It must stay self-contained: no imports, no module variables and no helpers from
 * outside this body, because the bookmark is this function's source text. Elements are built with DOM calls, never
 * HTML strings, and styles go through CSSOM, which a page's Content Security Policy does not block.
 */
export function fjbInject(start: InjectConfig): void {
  type Demo = { open: (next: InjectConfig) => void };
  const w = window as unknown as { __fjbDemo?: Demo };
  if (w.__fjbDemo) {
    w.__fjbDemo.open(start);
    return;
  }

  let cfg = start;
  const added: HTMLElement[] = [];
  /** Each script the bookmark needed on this page (Firework's SDK, AVA), by URL. */
  const scripts: Record<string, 'loading' | 'ready' | 'blocked'> = {};

  // ---------- panel, in a shadow root so the site's CSS can't reach it ----------
  const host = document.createElement('div');
  host.setAttribute('data-fjb-demo', 'panel');
  const root = host.attachShadow({ mode: 'open' });
  const css = `
    :host { all: initial; }
    .p { position: fixed; z-index: 2147483647; left: 16px; bottom: 16px; width: 310px; max-width: calc(100vw - 32px);
      box-sizing: border-box; padding: 14px 16px; border-radius: 14px; background: #13212b; color: #f4f1ea;
      font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 10px 34px rgba(0, 0, 0, .35); }
    .t { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 650; }
    .s { color: #b9c4cc; font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
    .m { margin: 10px 0 0; font-size: 13px; }
    .m.e { color: #ffb8a6; }
    .r { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    button { font: inherit; font-size: 13px; border-radius: 999px; padding: 6px 13px; border: 1px solid #5b6b76;
      background: transparent; color: inherit; cursor: pointer; }
    button.go { background: #e8743b; border-color: #e8743b; color: #13212b; font-weight: 650; }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    button.x { border: 0; padding: 0 6px; font-size: 20px; line-height: 1; }`;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
  }
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    node.className = cls;
    node.textContent = text;
    return node;
  };
  const panel = el('div', 'p');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Firework demo');
  const title = el('div', 't');
  const hide = el('button', 'x', '×');
  hide.setAttribute('aria-label', 'Hide this panel');
  hide.title = 'Hide. Click the bookmark again to bring it back.';
  title.append(el('span', '', 'Firework demo'), hide);
  const sub = el('div', 's');
  const note = el('div', 's', 'Only in your browser. Reload the page to remove everything.');
  const msg = el('p', 'm');
  msg.setAttribute('role', 'status');
  const row = el('div', 'r');
  const placeBtn = el('button', 'go');
  const undoBtn = el('button', '', 'Undo');
  row.append(placeBtn, undoBtn);
  panel.append(title, sub, note, msg, row);
  root.appendChild(panel);
  document.documentElement.appendChild(host);

  const say = (text: string, error = false) => {
    msg.textContent = text;
    msg.className = error ? 'm e' : 'm';
  };
  const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const refresh = () => {
    sub.textContent = `${cfg.layout} · ${cfg.source}`;
    placeBtn.textContent = cfg.floating ? 'Add to the corner' : `Place ${cfg.what.replace(/^the /, '')}`;
    undoBtn.disabled = added.length === 0;
  };
  const hostOf = (url: string) => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  };

  // ---------- scripts ----------
  /** A script can't run here. Its widgets will never render, so they go, and the page is as it was. */
  const blocked = (src: string | null, text: string) => {
    for (const s of Object.keys(scripts)) if (src === null || s === src) scripts[s] = 'blocked';
    for (let i = added.length - 1; i >= 0; i--) {
      if (src === null || added[i]!.dataset.fjbScript === src) added.splice(i, 1)[0]!.remove();
    }
    refresh();
    say(text, true);
  };
  document.addEventListener('securitypolicyviolation', (e) => {
    const blockedHost = hostOf(e.blockedURI);
    if (!/fw|firework/i.test(blockedHost)) return;
    // Firework's or AVA's own script, or one of the hosts both need (such as Firework's API).
    const src = Object.keys(scripts).find((s) => hostOf(s) === blockedHost) ?? null;
    blocked(src, `This site's security policy (Content Security Policy, ${e.effectiveDirective}) blocks ${blockedHost}, so ${src ? 'this' : 'Firework'} can't run here. Try another page of the site, or show the Fjordbloom store instead.`);
  });

  function loadScript(): void {
    const { src, module, present } = cfg.script;
    if (scripts[src]) return;
    // The site may already have it. Firework's lazy loader also picks up new widgets by itself.
    if (document.querySelector(present) || customElements.get(cfg.tag)) {
      scripts[src] = 'ready';
      return;
    }
    scripts[src] = 'loading';
    try {
      const s = document.createElement('script');
      if (module) s.type = 'module';
      s.async = true;
      s.src = src;
      // Essential requests only, so this visit stays out of the channel's Insights as far as the SDK allows.
      s.setAttribute('data-fwparam_tracking_opt_in', 'true');
      s.onload = () => {
        if (scripts[src] === 'loading') scripts[src] = 'ready';
      };
      s.onerror = () => {
        if (scripts[src] !== 'blocked') blocked(src, `${capital(cfg.what)} could not load here. An ad blocker or the site's security settings stopped it.`);
      };
      (document.head ?? document.documentElement).appendChild(s);
    } catch (e) {
      // Sites with Trusted Types refuse plain script URLs.
      blocked(src, `This site does not allow added scripts (${e instanceof Error ? e.message : String(e)}), so ${cfg.what} can't run here.`);
    }
  }

  // ---------- adding a widget ----------
  function insert(after: HTMLElement | null): void {
    const c = cfg;
    const wrap = document.createElement('div');
    wrap.setAttribute('data-fjb-demo', 'widget');
    wrap.dataset.fjbScript = c.script.src;
    if (c.floating) wrap.dataset.floating = 'true';
    else wrap.style.cssText = 'display:block;box-sizing:border-box;width:100%;max-width:1240px;margin:32px auto;padding:0 16px;clear:both;';
    const widget = document.createElement(c.tag);
    Object.keys(c.attrs).forEach((name) => widget.setAttribute(name, c.attrs[name] ?? ''));
    if (c.style) widget.style.cssText = c.style;
    widget.addEventListener('fw:embed-feed:error', () => say(c.empty, true));
    wrap.appendChild(widget);
    if (after) after.insertAdjacentElement('afterend', wrap);
    else document.body.appendChild(wrap);
    added.push(wrap);
    refresh();
    if (after) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    loadScript();
    if (scripts[c.script.src] === 'blocked') return;
    say(`${c.layout} added${after ? '' : ' to the corner'}. Place more, or Undo to take it away.`);
    window.setTimeout(() => {
      if (scripts[c.script.src] === 'blocked' || !wrap.isConnected) return;
      if (!customElements.get(c.tag)) say(`${capital(c.what)} has not loaded after 15 seconds. Check the connection, or try another page.`, true);
      else if (!c.floating && widget.getBoundingClientRect().height < 8) say(c.empty, true);
    }, 15000);
  }

  // ---------- choosing where: the block under the mouse, ↑ for a bigger one ----------
  const LEAF = /^(H[1-6]|P|SPAN|A|IMG|PICTURE|SVG|PATH|G|USE|BUTTON|LABEL|STRONG|EM|B|I|SMALL|LI|INPUT|SELECT|VIDEO|SOURCE|FIGCAPTION|TD|TH)$/;
  const isTop = (n: Element | null) => !n || n === document.body || n === document.documentElement;
  function band(from: Element | null, up: number): HTMLElement | null {
    let n = from;
    // Text, images and links belong to a bigger block. Start from a block at least 60% of the window wide.
    while (n && !isTop(n.parentElement) && (LEAF.test(n.tagName.toUpperCase()) || n.getBoundingClientRect().width < window.innerWidth * 0.6)) {
      n = n.parentElement;
    }
    for (let i = 0; i < up && n && !isTop(n.parentElement); i++) n = n.parentElement;
    return n && !isTop(n) && n instanceof HTMLElement ? n : null;
  }

  const box = document.createElement('div');
  box.setAttribute('data-fjb-demo', 'outline');
  box.style.cssText =
    'position:fixed;z-index:2147483646;pointer-events:none;box-sizing:border-box;border:3px solid #e8743b;border-bottom-width:8px;border-radius:6px;background:rgba(232,116,59,.12);display:none;';
  let placing = false;
  let hovered: Element | null = null;
  let up = 0;
  let selected: HTMLElement | null = null;

  const ours = (e: Event) => e.composedPath().includes(host);
  const draw = () => {
    selected = band(hovered, up);
    while (up > 0 && selected && selected === band(hovered, up - 1)) selected = band(hovered, --up);
    if (!selected) {
      box.style.display = 'none';
      return;
    }
    const r = selected.getBoundingClientRect();
    box.style.top = `${r.top}px`;
    box.style.left = `${r.left}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
    box.style.display = 'block';
  };
  const swallow = (e: Event) => {
    if (ours(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onMove = (e: Event) => {
    if (ours(e) || e.target === hovered) return;
    hovered = e.target as Element;
    up = 0;
    draw();
  };
  const onClick = (e: Event) => {
    if (ours(e)) return;
    swallow(e);
    if (e.target !== hovered) {
      hovered = e.target as Element;
      up = 0;
    }
    draw();
    if (!selected) return say('Pick a block inside the page.', true);
    const target = selected;
    stopPlacing();
    insert(target);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      swallow(e);
      stopPlacing();
      say('Cancelled.');
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      swallow(e);
      up = Math.max(0, up + (e.key === 'ArrowUp' ? 1 : -1));
      draw();
    }
  };
  // While placing, the page's own clicks, taps and keys do nothing: no links followed, no menus opened.
  const handlers: [string, EventListener][] = [
    ['mousemove', onMove],
    ['click', onClick],
    ['keydown', onKey as EventListener],
    ['scroll', draw],
    ...['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu'].map((t): [string, EventListener] => [t, swallow]),
  ];
  const listen = (on: boolean) => {
    for (const [type, fn] of handlers) {
      if (on) window.addEventListener(type, fn, true);
      else window.removeEventListener(type, fn, true);
    }
  };

  function startPlacing(): void {
    if (scripts[cfg.script.src] === 'blocked') {
      say(`${capital(cfg.what)} can't run on this page: the site blocked it. Try another page, or show the Fjordbloom store instead.`, true);
      return;
    }
    if (cfg.floating) {
      stopPlacing();
      if (added.some((a) => a.dataset.floating === 'true')) say(`${cfg.layout} is already in the corner. Undo takes it away.`);
      else insert(null);
      return;
    }
    if (placing) return;
    placing = true;
    hovered = null;
    up = 0;
    document.documentElement.appendChild(box);
    listen(true);
    placeBtn.disabled = true;
    say(`${capital(cfg.what)} will sit under the highlighted block. ↑ picks a bigger block, ↓ a smaller one. Click to place, Esc to cancel.`);
  }
  function stopPlacing(): void {
    if (!placing) return;
    placing = false;
    listen(false);
    box.remove();
    placeBtn.disabled = false;
  }

  placeBtn.addEventListener('click', startPlacing);
  undoBtn.addEventListener('click', () => {
    added.pop()?.remove();
    refresh();
    say(added.length ? 'Removed the last one.' : "Removed. The page is as it was, apart from Firework's scripts.");
  });
  hide.addEventListener('click', () => {
    stopPlacing();
    host.style.display = 'none';
  });

  w.__fjbDemo = {
    open(next: InjectConfig) {
      stopPlacing();
      cfg = next;
      host.style.display = '';
      refresh();
      startPlacing();
    },
  };
  refresh();
  startPlacing();
}

/** The code the bookmark runs. `void` keeps the browser from replacing the page with a return value. */
export const bookmarkletCode = (cfg: InjectConfig): string => `void (${fjbInject.toString()})(${JSON.stringify(cfg)})`;

export const bookmarkletHref = (cfg: InjectConfig): string => `javascript:${encodeURIComponent(bookmarkletCode(cfg))}`;
