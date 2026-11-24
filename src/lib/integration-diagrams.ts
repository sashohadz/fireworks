/**
 * How a shop and Firework connect, drawn twice: a high-level picture for management (shopper, video, your shop, in
 * plain words) and a detailed sequence for developers (hook names, API calls, data, failure paths). A toggle switches
 * every diagram on the page between the two (data-dg-view on <html>, remembered in localStorage).
 *
 * Pure string building, no DOM: used by /lab/shopping and by private pitch pages. Colours come from --dg-* custom
 * properties, which each page maps to its own theme (see diagramCss).
 */

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ---------------------------------------------------------------- detailed: sequence diagrams

export interface SeqStep {
  from: number;
  to: number;
  label: string;
  /** A call the shop's developers write (a Firework hook or SDK call): drawn in the accent colour, in code type. */
  hook?: boolean;
  /** A failure path: dashed, in the danger colour. */
  fail?: boolean;
}

export interface Seq {
  lanes: string[];
  steps: SeqStep[];
}

/** Lanes left to right, one arrow per step, top to bottom. A step from a lane to itself is a note on that lane. */
export function seqSvg(id: string, seq: Seq, aria: string): string {
  const W = 560;
  const top = 40;
  const row = 34;
  const H = top + 18 + seq.steps.length * row;
  const x = (i: number) => 74 + (i * (W - 148)) / Math.max(1, seq.lanes.length - 1);
  const lanes = seq.lanes
    .map((l, i) => {
      const w = Math.max(96, l.length * 6.6 + 16);
      return `<rect class="dg-lane" x="${(x(i) - w / 2).toFixed(1)}" y="6" width="${w.toFixed(1)}" height="24" rx="6"/>
      <text class="dg-lane-t" x="${x(i)}" y="22" text-anchor="middle">${esc(l)}</text>
      <line class="dg-life" x1="${x(i)}" y1="30" x2="${x(i)}" y2="${H - 6}"/>`;
    })
    .join('');
  const steps = seq.steps
    .map((s, k) => {
      const y = top + 16 + k * row;
      const num = `<circle class="dg-num" cx="14" cy="${y - 4}" r="8"/><text class="dg-num-t" x="14" y="${y - 0.5}" text-anchor="middle">${k + 1}</text>`;
      const kind = s.fail ? ' fail' : s.hook ? ' hook' : '';
      if (s.from === s.to) {
        const w = Math.min(W - 40, s.label.length * 6.2 + 18);
        const cx = Math.min(W - 6 - w / 2, Math.max(28 + w / 2, x(s.from)));
        return `${num}<rect class="dg-note${kind}" x="${(cx - w / 2).toFixed(1)}" y="${y - 16}" width="${w.toFixed(1)}" height="22" rx="5"/><text class="dg-note-t" x="${cx.toFixed(1)}" y="${y - 1}" text-anchor="middle">${esc(s.label)}</text>`;
      }
      const dir = s.to > s.from ? 1 : -1;
      const mid = (x(s.from) + x(s.to)) / 2;
      const head = s.fail ? 'fail' : s.hook ? 'acc' : 'ink';
      return `${num}<line class="dg-msg${kind}" x1="${x(s.from) + dir * 3}" y1="${y}" x2="${x(s.to) - dir * 4}" y2="${y}" marker-end="url(#${id}-${head})"/>
        <text class="dg-msg-t${kind}" x="${mid}" y="${y - 6}" text-anchor="middle">${esc(s.label)}</text>`;
    })
    .join('');
  const marker = (suffix: string, cls: string) =>
    `<marker id="${id}-${suffix}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head${cls}" d="M0,0 L10,5 L0,10 z"/></marker>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">
    <defs>${marker('ink', '')}${marker('acc', ' hook')}${marker('fail', ' fail')}</defs>
    ${lanes}${steps}
  </svg>`;
}

// ---------------------------------------------------------------- high level: two boxes and plain arrows

export interface OverviewRow {
  /** What the shopper sees on Firework's side. */
  fw: string;
  /** The part of the shop involved. */
  shop: string;
  /** Firework → shop. */
  out?: string;
  /** Shop → Firework. */
  back?: string;
}

export interface Overview {
  fwSub: string;
  shopTitle: string;
  shopSub: string;
  rows: OverviewRow[];
}

/** Firework on the left, the shop on the right, one numbered row per thing that passes between them. */
export function overviewSvg(id: string, o: Overview, aria: string): string {
  const W = 860;
  const y0 = (i: number) => 104 + i * 68;
  const H = y0(o.rows.length - 1) + 40;
  const L = { x: 16, w: 250 };
  const R = { x: W - 16 - 250, w: 250 };
  const a1 = L.x + L.w + 8;
  const a2 = R.x - 8;
  const mid = (a1 + a2) / 2;
  const box = (b: { x: number; w: number }, cls: string) => `<rect class="${cls}" x="${b.x}" y="10" width="${b.w}" height="${H - 20}" rx="14"/>`;
  const chip = (b: { x: number; w: number }, y: number, text: string, n?: number) =>
    `<rect class="dg-chip" x="${b.x + 12}" y="${y - 17}" width="${b.w - 24}" height="34" rx="8"/>${
      n ? `<circle class="dg-ov-num" cx="${b.x + 30}" cy="${y}" r="10"/><text class="dg-ov-num-t" x="${b.x + 30}" y="${y + 4}" text-anchor="middle">${n}</text>` : ''
    }<text class="dg-chip-t" x="${n ? b.x + 48 : b.x + 26}" y="${y + 4}">${esc(text)}</text>`;
  const arrow = (y: number, dir: 1 | -1, label: string, below: boolean) => {
    const [xa, xb] = dir === 1 ? [a1, a2] : [a2, a1];
    const side = dir === 1 ? 'fw' : 'shop';
    return `<line class="dg-arrow ${side}" x1="${xa}" y1="${y}" x2="${xb - dir * 2}" y2="${y}" marker-end="url(#${id}-${side})"/>
      <text class="dg-label" x="${mid}" y="${below ? y + 17 : y - 8}" text-anchor="middle">${esc(label)}</text>`;
  };
  const rows = o.rows
    .map((r, i) => {
      const y = y0(i);
      const both = Boolean(r.out && r.back);
      return chip(L, y, r.fw, i + 1) + chip(R, y, r.shop) + (r.out ? arrow(both ? y - 7 : y, 1, r.out, false) : '') + (r.back ? arrow(both ? y + 7 : y, -1, r.back, both) : '');
    })
    .join('');
  const video = `<rect class="dg-icon fw" x="${L.x + 18}" y="24" width="24" height="40" rx="5"/><path class="dg-icon-fill fw" d="M${L.x + 26},37 L${L.x + 36},44 L${L.x + 26},51 z"/>`;
  const bag = `<path class="dg-icon shop" d="M${R.x + 18},34 h26 l-2,30 h-22 z"/><path class="dg-icon shop" d="M${R.x + 24},34 v-4 a7,7 0 0 1 14,0 v4"/>`;
  const marker = (side: string) =>
    `<marker id="${id}-${side}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-arrow-head ${side}" d="M0,0 L10,5 L0,10 z"/></marker>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">
    <defs>${marker('fw')}${marker('shop')}</defs>
    ${box(L, 'dg-box fw')}${box(R, 'dg-box shop')}
    ${video}<text class="dg-title fw" x="${L.x + 54}" y="42">Firework</text><text class="dg-sub" x="${L.x + 54}" y="60">${esc(o.fwSub)}</text>
    ${bag}<text class="dg-title" x="${R.x + 54}" y="42">${esc(o.shopTitle)}</text><text class="dg-sub" x="${R.x + 54}" y="60">${esc(o.shopSub)}</text>
    ${rows}
  </svg>`;
}

// ---------------------------------------------------------------- the flows

export interface FlowView {
  svg: string;
  caption: string;
}

export interface Flow {
  id: string;
  title: string;
  high: FlowView;
  detailed: FlowView;
}

export interface FlowOptions {
  /** The shop's name in the diagrams, e.g. "Your shop". */
  shop?: string;
  /** Example market for the detailed view. */
  country?: { code: string; name: string; currency: string; price: string };
}

const defaults = { shop: 'Your shop', country: { code: 'ch', name: 'Switzerland', currency: 'CHF', price: 'CHF 31.90' } };

/** Prices and stock per country: product hydration. */
export function hydrationFlow(options: FlowOptions = {}): Flow {
  const { shop, country: c } = { ...defaults, ...options };
  const highRows: OverviewRow[] = [
    { fw: 'A video with products starts', shop: `Price list for the shopper’s country`, out: `asks: price and stock for these?`, back: `answers in ${c.currency}, with stock` },
    { fw: `Product card shows ${c.price}`, shop: `Products not sold in ${c.name}`, back: 'answers: not available here' },
  ];
  const seq: Seq = {
    lanes: ['Firework player', 'Your page code', 'Your product API'],
    steps: [
      { from: 0, to: 1, label: 'onProductsLoaded({ products })', hook: true },
      { from: 1, to: 2, label: `GET /api/${c.code}/products/FJB-103.json` },
      { from: 2, to: 1, label: `{ price: 31.90, currency: '${c.currency}', stock }` },
      { from: 1, to: 0, label: `productFactory(…).currency('${c.currency}')`, hook: true },
      { from: 0, to: 0, label: `product card shows ${c.price}` },
      { from: 1, to: 0, label: `not sold in ${c.code.toUpperCase()}: isAvailable(false)`, hook: true },
      { from: 1, to: 0, label: 'hook throws or is slow: Firework’s stored price', fail: true },
    ],
  };
  return {
    id: 'dg-hydration',
    title: 'Prices per country (product hydration)',
    high: {
      svg: overviewSvg('dg-hydration-high', { fwSub: 'videos with product cards', shopTitle: shop, shopSub: 'prices and stock, per country', rows: highRows }, `Firework asks ${shop} for the price and stock of the products in a video; ${shop} answers in the shopper's currency, or says a product isn't sold there.`),
      caption: `The video always shows ${shop.toLowerCase() === 'your shop' ? 'your' : `${shop}’s`} price for the shopper’s country, not a copy stored at Firework. If the shop can’t answer, the video quietly shows the price stored in Firework, so the answer should be fast and reliable.`,
    },
    detailed: {
      svg: seqSvg('dg-hydration-detail', seq, `Firework calls onProductsLoaded; the page code asks the product API for the ${c.name} price list and returns products built with productFactory in ${c.currency}.`),
      caption: `Firework’s catalog stays in one currency; the shop’s API answers per market, and productFactory carries the currency. Return both price and originalPrice (a price alone shows as a sale). Web: no way to hide a product, so mark it unavailable; the app SDK has hidden: true. If the hook throws, shoppers see no error.`,
    },
  };
}

/** Add to bag and the bag icon: cart sync. */
export function cartFlow(options: FlowOptions = {}): Flow {
  const { shop, country: c } = { ...defaults, ...options };
  const seq: Seq = {
    lanes: ['Shopper', 'Firework player', 'Your page code', 'Your bag API'],
    steps: [
      { from: 0, to: 1, label: 'taps Add to Bag' },
      { from: 1, to: 2, label: 'onCartUpdated(update)', hook: true },
      { from: 2, to: 3, label: 'add 1, check stock' },
      { from: 3, to: 2, label: 'saved' },
      { from: 2, to: 1, label: 'return quantity', hook: true },
      { from: 2, to: 1, label: 'throw: “Failed to update cart”', fail: true },
      { from: 0, to: 1, label: 'taps the bag icon' },
      { from: 1, to: 2, label: 'onCartDisplayed()', hook: true },
      { from: 2, to: 1, label: `bag lines, in ${c.currency}`, hook: true },
      { from: 1, to: 3, label: 'Check out: configureCart({ url })' },
    ],
  };
  return {
    id: 'dg-cart',
    title: 'Add to bag and the bag (cart sync)',
    high: {
      svg: overviewSvg(
        'dg-cart-high',
        {
          fwSub: 'Add to bag inside the video',
          shopTitle: shop,
          shopSub: 'one bag, one checkout',
          rows: [
            { fw: '“Add to bag” in the video', shop: 'The shopper’s bag', out: 'adds the product', back: 'answers: added, or why not' },
            { fw: 'Bag icon in the video', shop: 'The shopper’s bag', out: 'asks: what’s in the bag?', back: 'answers: these products' },
            { fw: '“Check out”', shop: 'Your checkout', out: 'opens the shop’s checkout' },
          ],
        },
        `Add to bag in the video goes into ${shop}'s bag; the bag icon shows that bag; checkout stays the shop's.`,
      ),
      caption: 'There is one bag: the shop’s. The video adds to it and shows it; payment, delivery and the customer stay with the shop, which also checks stock before anything is added.',
    },
    detailed: {
      svg: seqSvg('dg-cart-detail', seq, 'Firework calls onCartUpdated when the shopper adds to bag and onCartDisplayed when the bag icon is tapped; the page code answers from the shop’s bag.'),
      caption: 'update is one object: { product, productUnit, quantity (new total), previousQuantity, video }. Return the quantity you saved (less caps it); throw to show “Failed to update cart” with your message. onCartDisplayed runs on player load and on each bag-icon tap. App SDK: onShoppingCTA returns { res, tips }, setCartItemCount drives the red dot, onCustomClickCartIcon opens your cart screen.',
    },
  };
}

/** The order after watching: purchase tracking and where it goes. */
export function purchaseFlow(options: FlowOptions = {}): Flow {
  const { shop, country: c } = { ...defaults, ...options };
  const seq: Seq = {
    lanes: ['Shopper', 'Firework player', 'Your web or app', 'Firework analytics'],
    steps: [
      { from: 0, to: 1, label: 'watches, taps a product, adds to bag' },
      { from: 1, to: 3, label: 'views, clicks (sent by the player)' },
      { from: 0, to: 2, label: 'places the order' },
      { from: 2, to: 3, label: 'web: analytics.purchase(order)', hook: true },
      { from: 2, to: 3, label: 'app: trackPurchase(order)', hook: true },
      { from: 3, to: 3, label: 'matches order to videos, server-side' },
      { from: 3, to: 3, label: 'Insights and Insights API, next day' },
    ],
  };
  return {
    id: 'dg-purchase',
    title: 'The order after watching (purchase tracking)',
    high: {
      svg: overviewSvg(
        'dg-purchase-high',
        {
          fwSub: 'remembers what each shopper watched',
          shopTitle: shop,
          shopSub: 'web shop and app',
          rows: [
            { fw: 'Videos watched, products tapped', shop: 'Order confirmation', back: 'tells: this order, these products' },
            { fw: 'Matches orders to videos', shop: 'Business Portal: Insights', out: 'reports sales from video, next day' },
          ],
        },
        `${shop} tells Firework about each order; Firework matches it to the videos the shopper watched and reports sales from video in Insights the next day.`,
      ),
      caption: 'Every order is reported, whether or not the shopper watched a video. Firework decides server-side which orders count as sales from video, so the shop doesn’t filter anything.',
    },
    detailed: {
      svg: seqSvg('dg-purchase-detail', seq, 'The player sends views and clicks itself; the shop sends the purchase from its order confirmation (web: analytics.purchase, app: trackPurchase); Firework attributes it and reports it in Insights the next day.'),
      caption: `Web: window._fwn.analytics.purchase({ order_id, currency: '${c.currency}', subtotal, order_value, line_items: [{ sku, quantity, price }] }). App: FireworkSDK.getInstance().trackPurchase({ orderId, currencyCode: '${c.currency}', value, subtotal, products: [{ sku, price, quantity }] }). Send every order in its own currency, with sku as the unit ID in Firework’s catalog. Commerce metrics in Insights are daily (T+1), attribution recomputed daily. Web: call _fwn.analytics only once it exists; with the lazy loader, add analytics.js to the confirmation page.`,
    },
  };
}

/**
 * Product text in the shopper's language: the same hydration call as the price, answered in the language as well
 * as the country, plus Firework's own buttons in that language. Web and app differ only in the calls.
 */
export function languageFlow(options: FlowOptions & { platform?: 'web' | 'app' } = {}): Flow {
  const { shop } = { ...defaults, ...options };
  const app = options.platform === 'app';
  const card = 'card: Sérum éclat vitamine C · 31,90 CHF';
  const fail = { from: 1, to: 0, label: 'throws or slow: Firework’s stored text', fail: true };
  const seq: Seq = app
    ? {
        lanes: ['Firework SDK', 'Your app code', 'Your product API'],
        steps: [
          { from: 1, to: 0, label: "changeAppLanguage('fr')", hook: true },
          { from: 0, to: 1, label: 'onUpdateProductDetails({ productIds })', hook: true },
          { from: 1, to: 2, label: 'GET /api/ch/fr/products/FJB-103.json' },
          { from: 2, to: 1, label: '{ name, subtitle, summary, price }' },
          { from: 1, to: 0, label: '{ name, subtitle, description }', hook: true },
          { from: 0, to: 0, label: card },
          fail,
        ],
      }
    : {
        lanes: ['Firework player', 'Your page code', 'Your product API'],
        steps: [
          { from: 0, to: 0, label: '<fw-storyblock lang="fr">: buttons in French' },
          { from: 0, to: 1, label: 'onProductsLoaded({ products })', hook: true },
          { from: 1, to: 2, label: 'GET /api/ch/fr/products/FJB-103.json' },
          { from: 2, to: 1, label: '{ name, subtitle, summary, price }' },
          { from: 1, to: 0, label: '.name().subtitle().description()', hook: true },
          { from: 0, to: 0, label: card },
          fail,
        ],
      };
  return {
    id: app ? 'dg-app-language' : 'dg-language',
    title: 'Product text in the shopper’s language',
    high: {
      svg: overviewSvg(
        `${app ? 'dg-app-language' : 'dg-language'}-high`,
        {
          fwSub: app ? 'videos in the app' : 'videos with product cards',
          shopTitle: shop,
          shopSub: 'product text, per language',
          rows: [
            { fw: 'A video with products starts', shop: 'Text in the shopper’s language', out: 'asks: text and price for these?', back: 'answers in French, in CHF' },
            { fw: 'Buttons: “Ajouter au sac”', shop: 'The shopper’s language', back: app ? 'sets the player’s language' : 'the page says: French' },
          ],
        },
        `Firework asks ${shop} for the products in a video; ${shop} answers with their name, subtitle and description in the shopper's language and the price in their currency. Firework's own buttons follow the ${app ? 'app' : 'page'} language.`,
      ),
      caption: `Firework stores one text per product. ${shop} answers with the text in the shopper’s language, in the same call as the price, and Firework’s buttons follow the ${app ? 'app' : 'page'} language. If the shop can’t answer, the video shows the text stored at Firework.`,
    },
    detailed: {
      svg: seqSvg(
        `${app ? 'dg-app-language' : 'dg-language'}-detail`,
        seq,
        app
          ? 'The app sets the SDK language with changeAppLanguage; on onUpdateProductDetails it asks its product API for Swiss French text and prices and returns name, subtitle and description.'
          : 'The widget has lang="fr"; on onProductsLoaded the page asks its product API for Swiss French text and prices and returns them with productFactory name, subtitle and description.',
      ),
      caption: app
        ? 'The country and the language are both in the request. On Android in our test, the name, subtitle and Firework’s buttons changed language; the description stayed Firework’s, although the SDK bridge passes it on (ask Firework). changeAppLanguage takes 24 languages, including de, fr, it and pl. On Android it recreates the screen, so call it last and add attachBaseContext to MainActivity; on iOS, add the languages in Xcode. Leave options and images out unless Firework’s catalog names them the same way: in our test they replaced the colour swatches.'
        : 'The country and the language are both in the request. .subtitle() is in the web SDK but not in Firework’s web docs; it worked in our test. The player’s buttons follow the widget’s lang attribute, then <html lang>, then the browser’s language (42 languages in the SDK). Right after Add to bag, the player’s bag shows Firework’s stored name until it reloads.',
    },
  };
}

export const allFlows = (options: FlowOptions = {}): Flow[] => [hydrationFlow(options), cartFlow(options), purchaseFlow(options)];

// ---------------------------------------------------------------- page parts

/** One flow as a figure with both views; CSS shows the one the toggle picked. */
export function renderFlow(flow: Flow): string {
  const view = (v: FlowView, cls: string) =>
    `<div class="${cls}"><div class="dg-scroll">${v.svg}</div><figcaption>${esc(v.caption)}</figcaption></div>`;
  return `<figure class="dg-figure" id="${esc(flow.id)}">
    <h3>${esc(flow.title)}</h3>
    ${view(flow.high, 'dg-high')}${view(flow.detailed, 'dg-detailed')}
  </figure>`;
}

/** The High level / Detailed switch. Radio inputs, so it works with the keyboard and screen readers. */
export function toggleHtml(name = 'dg-view'): string {
  return `<fieldset class="dg-toggle"><legend>Diagrams</legend>
    <label><input type="radio" name="${name}" value="high" checked /> <span>High level</span></label>
    <label><input type="radio" name="${name}" value="detailed" /> <span>Detailed</span></label>
  </fieldset>`;
}

export const DG_STORAGE_KEY = 'dg.view';

/** Behaviour for toggleHtml, as a function so pages can bundle it or inline it (String(installToggle)). */
export function installToggle(): void {
  const KEY = 'dg.view';
  const apply = (v: string) => {
    document.documentElement.dataset.dgView = v === 'detailed' ? 'detailed' : 'high';
    document.querySelectorAll<HTMLInputElement>('.dg-toggle input[type="radio"]').forEach((i) => (i.checked = i.value === document.documentElement.dataset.dgView));
  };
  let saved = 'high';
  try {
    saved = window.localStorage.getItem(KEY) ?? 'high';
  } catch {
    /* storage blocked: start high level */
  }
  apply(saved);
  document.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement | null;
    if (!input?.closest('.dg-toggle')) return;
    apply(input.value);
    try {
      window.localStorage.setItem(KEY, input.value);
    } catch {
      /* ignore */
    }
  });
}

/**
 * The same behaviour as installToggle, as plain JavaScript for pages built outside the site (inline it in a
 * <script>). Function.toString() of installToggle isn't safe there: build tools add helpers to it.
 */
export const toggleScript = `(function(){var KEY='dg.view';var root=document.documentElement;
function apply(v){root.dataset.dgView=v==='detailed'?'detailed':'high';document.querySelectorAll('.dg-toggle input[type="radio"]').forEach(function(i){i.checked=i.value===root.dataset.dgView;});}
var saved='high';try{saved=window.localStorage.getItem(KEY)||'high';}catch(e){}
apply(saved);
document.addEventListener('change',function(e){var t=e.target;if(!t||!t.closest||!t.closest('.dg-toggle'))return;apply(t.value);try{window.localStorage.setItem(KEY,t.value);}catch(e){}});})();`;

/**
 * Styles for the diagrams and the toggle. Pages set --dg-ink, --dg-soft, --dg-line, --dg-surface, --dg-bg,
 * --dg-accent, --dg-accent-bg and --dg-danger to their own colours.
 */
export const diagramCss = `
.dg-toggle { display: inline-flex; gap: 0; border: 1px solid var(--dg-line); border-radius: 999px; padding: 3px; margin: 0 0 12px; background: var(--dg-surface); }
.dg-toggle legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.dg-toggle label { position: relative; display: inline-flex; align-items: center; cursor: pointer; }
.dg-toggle input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.dg-toggle span { padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 600; color: var(--dg-soft); }
.dg-toggle input:checked + span { background: var(--dg-accent); color: var(--dg-surface); }
.dg-toggle input:focus-visible + span { outline: 2px solid var(--dg-accent); outline-offset: 2px; }
.dg-detailed { display: none; }
[data-dg-view="detailed"] .dg-detailed { display: block; }
[data-dg-view="detailed"] .dg-high { display: none; }
.dg-figure { margin: 0 0 16px; background: var(--dg-surface); border: 1px solid var(--dg-line); border-radius: 14px; padding: 16px; }
.dg-figure h3 { margin: 0 0 10px; font-size: 16px; }
.dg-scroll { overflow-x: auto; }
.dg-figure svg { display: block; width: 100%; height: auto; }
.dg-high svg { min-width: 640px; }
.dg-detailed svg { min-width: 500px; }
.dg-figure figcaption { font-size: 13.5px; color: var(--dg-soft); margin-top: 8px; max-width: 90ch; }
.dg-lane { fill: var(--dg-bg); stroke: var(--dg-line); }
.dg-lane-t { fill: var(--dg-ink); font-size: 11px; font-weight: 700; }
.dg-life { stroke: var(--dg-line); stroke-width: 1.5; stroke-dasharray: 3 4; }
.dg-msg { stroke: var(--dg-soft); stroke-width: 1.5; }
.dg-msg.hook { stroke: var(--dg-accent); stroke-width: 2; }
.dg-msg.fail { stroke: var(--dg-danger); stroke-dasharray: 5 4; }
.dg-head { fill: var(--dg-soft); } .dg-head.hook { fill: var(--dg-accent); } .dg-head.fail { fill: var(--dg-danger); }
.dg-msg-t { fill: var(--dg-ink); font-size: 11.5px; paint-order: stroke; stroke: var(--dg-surface); stroke-width: 4px; stroke-linejoin: round; }
.dg-msg-t.hook { fill: var(--dg-accent); font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; font-weight: 600; }
.dg-msg-t.fail { fill: var(--dg-danger); }
.dg-note { fill: var(--dg-accent-bg); stroke: var(--dg-accent); stroke-width: 1; }
.dg-note.fail { stroke: var(--dg-danger); }
.dg-note-t { fill: var(--dg-ink); font-size: 11px; }
.dg-num { fill: var(--dg-bg); stroke: var(--dg-line); }
.dg-num-t { fill: var(--dg-soft); font-size: 10px; font-weight: 700; }
.dg-box.fw { fill: var(--dg-accent-bg); stroke: var(--dg-accent); stroke-width: 1.5; }
.dg-box.shop { fill: var(--dg-bg); stroke: var(--dg-soft); stroke-width: 1.5; }
.dg-chip { fill: var(--dg-surface); stroke: var(--dg-line); }
.dg-chip-t { fill: var(--dg-ink); font-size: 12.5px; font-weight: 600; }
.dg-ov-num { fill: var(--dg-accent); }
.dg-ov-num-t { fill: var(--dg-surface); font-size: 11px; font-weight: 700; }
.dg-title { fill: var(--dg-ink); font-size: 16px; font-weight: 700; }
.dg-title.fw { fill: var(--dg-accent); }
.dg-sub { fill: var(--dg-soft); font-size: 12px; }
.dg-icon { fill: none; stroke-width: 2; } .dg-icon.fw { stroke: var(--dg-accent); } .dg-icon.shop { stroke: var(--dg-soft); }
.dg-icon-fill.fw { fill: var(--dg-accent); }
.dg-arrow { stroke-width: 2; } .dg-arrow.fw { stroke: var(--dg-accent); } .dg-arrow.shop { stroke: var(--dg-soft); }
.dg-arrow-head.fw { fill: var(--dg-accent); } .dg-arrow-head.shop { fill: var(--dg-soft); }
.dg-label { fill: var(--dg-ink); font-size: 12px; paint-order: stroke; stroke: var(--dg-surface); stroke-width: 4px; stroke-linejoin: round; }
`;
