// The "Firework demo" bookmarklet: adds a Firework widget to any website, in the presenter's browser tab only.
// /lab/bookmarklet builds the bookmark from fjbInject's source text, with the chosen layout and playlist baked in.
import type { LayoutTag } from './layouts';

export interface InjectConfig {
  /** Business Portal layout name, shown in the panel. */
  layout: string;
  tag: LayoutTag;
  attrs: Record<string, string>;
  /** Inline style the element needs, such as the horizontal player's 16:9 box. */
  style: string;
  /** Floating layouts need no placement: they go straight into the corner. */
  floating: boolean;
  channel: string;
  /** Empty for the whole channel. */
  playlist: string;
  /** Firework's SDK, module build. */
  sdk: string;
}

/** Channel names and playlist IDs the builder accepts, so the bookmark never carries anything else. */
export const CHANNEL_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
export const PLAYLIST_PATTERN = /^[A-Za-z0-9_-]{0,32}$/;

/**
 * Runs on someone else's page. It must stay self-contained: no imports, no module variables and no helpers from
 * outside this body, because the bookmark is this function's source text. Elements are built with DOM calls, never
 * HTML strings, and styles go through CSSOM, which a page's Content Security Policy does not block.
 */
export function fjbInject(start: InjectConfig): void {
  type Demo = { open: (next: InjectConfig) => void };
  const w = window as unknown as { __fjbDemo?: Demo; _fwn?: unknown };
  if (w.__fjbDemo) {
    w.__fjbDemo.open(start);
    return;
  }

  let cfg = start;
  const added: HTMLElement[] = [];
  let sdk: 'none' | 'loading' | 'ready' | 'blocked' = 'none';
  let blockedBy = '';

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
  const placeBtn = el('button', 'go', 'Place videos');
  const undoBtn = el('button', '', 'Undo');
  row.append(placeBtn, undoBtn);
  panel.append(title, sub, note, msg, row);
  root.appendChild(panel);
  document.documentElement.appendChild(host);

  const say = (text: string, error = false) => {
    msg.textContent = text;
    msg.className = error ? 'm e' : 'm';
  };
  const refresh = () => {
    sub.textContent = `${cfg.layout} · ${cfg.channel}${cfg.playlist ? ` / ${cfg.playlist}` : ''}`;
    placeBtn.textContent = cfg.floating ? 'Add to the corner' : 'Place videos';
    undoBtn.disabled = added.length === 0;
  };
  const hostOf = (url: string) => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  };

  // ---------- Firework's script ----------
  const blocked = (text: string) => {
    sdk = 'blocked';
    // Nothing will render, so leave the page as it was.
    added.splice(0).forEach((a) => a.remove());
    refresh();
    say(text, true);
  };
  document.addEventListener('securitypolicyviolation', (e) => {
    if (!/fw|firework/i.test(hostOf(e.blockedURI))) return;
    blockedBy = e.blockedURI;
    blocked(`This site's security policy (Content Security Policy, ${e.effectiveDirective}) blocks ${hostOf(e.blockedURI)}, so Firework can't run here. Try another page of the site, or show the Fjordbloom store instead.`);
  });

  function loadSdk(): void {
    if (sdk !== 'none') return;
    // The site may already use Firework, or only its lazy loader, which picks up new widgets by itself.
    if (document.querySelector('script[src*="/fwn"]') || customElements.get(cfg.tag)) {
      sdk = 'ready';
      return;
    }
    sdk = 'loading';
    try {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = cfg.sdk;
      // Essential requests only, so this visit stays out of the channel's Insights as far as the SDK allows.
      s.setAttribute('data-fwparam_tracking_opt_in', 'true');
      s.onload = () => (sdk = 'ready');
      s.onerror = () => {
        if (!blockedBy) blocked("Firework's script could not load here. An ad blocker or the site's security settings stopped it.");
      };
      (document.head ?? document.documentElement).appendChild(s);
    } catch (e) {
      // Sites with Trusted Types refuse plain script URLs.
      blocked(`This site does not allow added scripts (${e instanceof Error ? e.message : String(e)}), so Firework can't run here.`);
    }
  }

  // ---------- adding a widget ----------
  function insert(after: HTMLElement | null): void {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-fjb-demo', 'widget');
    if (cfg.floating) wrap.dataset.floating = 'true';
    else wrap.style.cssText = 'display:block;box-sizing:border-box;width:100%;max-width:1240px;margin:32px auto;padding:0 16px;clear:both;';
    const widget = document.createElement(cfg.tag);
    widget.setAttribute('channel', cfg.channel);
    if (cfg.playlist) widget.setAttribute('playlist', cfg.playlist);
    Object.keys(cfg.attrs).forEach((name) => widget.setAttribute(name, cfg.attrs[name] ?? ''));
    if (cfg.style) widget.style.cssText = cfg.style;
    const source = cfg.playlist ? `playlist ${cfg.playlist}` : `channel ${cfg.channel}`;
    widget.addEventListener('fw:embed-feed:error', () => say(`Firework returned no videos for ${source}.`, true));
    wrap.appendChild(widget);
    if (after) after.insertAdjacentElement('afterend', wrap);
    else document.body.appendChild(wrap);
    added.push(wrap);
    refresh();
    if (after) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    loadSdk();
    if (sdk === 'blocked') return;
    say(`${cfg.layout} added${after ? '' : ' to the corner'}. Place more, or Undo to take it away.`);
    const tag = cfg.tag;
    window.setTimeout(() => {
      if (!customElements.get(tag) && sdk !== 'blocked') say('Firework has not loaded after 15 seconds. Check the connection, or try another page.', true);
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
    say('The videos go under the highlighted block. ↑ picks a bigger block, ↓ a smaller one. Click to place, Esc to cancel.');
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
    say(added.length ? 'Removed the last one.' : 'Removed. The page is as it was, apart from Firework\'s script.');
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
      if (sdk !== 'blocked') startPlacing();
    },
  };
  refresh();
  startPlacing();
}

/** The code the bookmark runs. `void` keeps the browser from replacing the page with a return value. */
export const bookmarkletCode = (cfg: InjectConfig): string => `void (${fjbInject.toString()})(${JSON.stringify(cfg)})`;

export const bookmarkletHref = (cfg: InjectConfig): string => `javascript:${encodeURIComponent(bookmarkletCode(cfg))}`;
