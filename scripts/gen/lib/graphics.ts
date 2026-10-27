// Renders title cards, price cards, captions and the brand overlay as PNGs with headless Chromium.
// HTML and CSS give exact brand typography (the site's own variable fonts) on any OS.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { ROOT } from './paths';

export const W = 1080;
export const H = 1920;

function fontFace(family: string, pkg: string, file: string): string {
  const data = fs.readFileSync(path.join(ROOT, 'node_modules', '@fontsource-variable', pkg, 'files', file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
}

let fontCss: string | null = null;
function fonts(): string {
  fontCss ??= fontFace('Fraunces', 'fraunces', 'fraunces-latin-wght-normal.woff2') + fontFace('Inter', 'inter', 'inter-latin-wght-normal.woff2');
  return fontCss;
}

export function imageDataUri(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(body: string, css: string, transparent = false): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts()}
    *{box-sizing:border-box}
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${transparent ? 'transparent' : '#F7F5F0'};}
    body{font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;}
    ${css}</style></head><body>${body}</body></html>`;
}

const MARK = `<svg width="72" height="72" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#2F5D73"/><path d="M5 20 C 9 16, 12 16, 16 19 S 23 22, 27 18 L 27 24 C 23 27, 9 27, 5 24 Z" fill="#E6EBE8"/><circle cx="16" cy="11" r="4.2" fill="#E8913A"/></svg>`;

export function titleCardHtml(o: { text: string; subtext?: string }): string {
  return page(
    `<div class="card">${MARK}<p class="brand">FJORDBLOOM</p><h1>${esc(o.text)}</h1>${o.subtext ? `<p class="sub">${esc(o.subtext)}</p>` : ''}</div>`,
    `body{background:radial-gradient(circle at 50% 22%, rgba(232,145,58,.28), transparent 42%), linear-gradient(180deg,#2F5D73 0%,#14212B 100%);}
     .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 110px;color:#F7F5F0;}
     .brand{font-weight:600;font-size:30px;letter-spacing:.32em;margin:28px 0 40px;color:#E6EBE8;}
     h1{font-family:'Fraunces',serif;font-weight:500;font-size:104px;line-height:1.06;margin:0;letter-spacing:-.01em;}
     .sub{font-size:44px;line-height:1.35;color:#E6EBE8;margin:44px 0 0;max-width:820px;}`,
  );
}

export function priceCardHtml(o: { name: string; unitName?: string; price: string; compare?: string; cta: string; image: string }): string {
  return page(
    `<div class="card"><p class="brand">FJORDBLOOM</p><img src="${o.image}" alt=""><h1>${esc(o.name)}</h1>
      ${o.unitName ? `<p class="unit">${esc(o.unitName)}</p>` : ''}
      <p class="price"><span class="${o.compare ? 'sale' : ''}">${esc(o.price)}</span>${o.compare ? `<s>${esc(o.compare)}</s>` : ''}</p>
      <p class="cta">${esc(o.cta)}</p></div>`,
    `body{background:linear-gradient(180deg,#F7F5F0 0%,#E6EBE8 100%);}
     .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 90px;color:#14212B;}
     .brand{font-weight:600;font-size:28px;letter-spacing:.32em;color:#46545E;margin:0 0 36px;}
     img{width:700px;height:700px;object-fit:cover;border-radius:36px;box-shadow:0 30px 80px rgba(20,33,43,.18);}
     h1{font-family:'Fraunces',serif;font-weight:500;font-size:72px;line-height:1.08;margin:56px 0 0;}
     .unit{font-size:38px;color:#6C7880;margin:16px 0 0;}
     .price{font-weight:650;font-size:76px;margin:28px 0 0;}
     .sale{color:#B8661F}
     s{font-weight:400;font-size:48px;color:#6C7880;margin-left:22px}
     .cta{margin:48px 0 0;background:#2F5D73;color:#fff;font-weight:600;font-size:46px;padding:26px 64px;border-radius:999px;}`,
  );
}

export function captionHtml(text: string): string {
  return page(
    `<div class="cap"><span>${esc(text)}</span></div>`,
    `.cap{position:absolute;left:0;right:0;top:1290px;display:flex;justify-content:center;padding:0 80px;}
     span{background:rgba(20,33,43,.74);color:#fff;font-weight:600;font-size:52px;line-height:1.25;padding:22px 40px;border-radius:30px;text-align:center;max-width:920px;}`,
    true,
  );
}

export function chromeHtml(label: string): string {
  return page(
    `<div class="top"><span class="word">Fjordbloom</span><span class="label">${esc(label)}</span></div>`,
    `.top{position:absolute;left:0;right:0;top:170px;display:flex;flex-direction:column;align-items:center;gap:10px;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.45);}
     .word{font-family:'Fraunces',serif;font-weight:500;font-size:46px;}
     .label{font-size:24px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;opacity:.85;}`,
    true,
  );
}

/** Fallback frame used when no AI clip exists yet: the product image over a blurred copy of itself. */
export function stillFrameHtml(image: string): string {
  return page(
    `<div class="bg" style="background-image:url('${image}')"></div><img src="${image}" alt="">`,
    `.bg{position:absolute;inset:-80px;background-size:cover;background-position:center;filter:blur(46px) brightness(.92) saturate(1.1);}
     img{position:absolute;left:50%;top:50%;width:900px;transform:translate(-50%,-52%);border-radius:40px;box-shadow:0 40px 90px rgba(20,33,43,.28);}`,
  );
}

export class Renderer {
  private constructor(
    private readonly browser: Browser,
    private readonly page: Page,
  ) {}

  static async open(): Promise<Renderer> {
    const browser = await chromium.launch();
    const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    return new Renderer(browser, pg);
  }

  async render(html: string, out: string, opts: { transparent?: boolean; type?: 'png' | 'jpeg' } = {}): Promise<string> {
    await this.page.setContent(html, { waitUntil: 'load' });
    await this.page.evaluate(() => document.fonts.ready);
    await fs.promises.mkdir(path.dirname(out), { recursive: true });
    const type = opts.type ?? 'png';
    await this.page.screenshot({ path: out, type, omitBackground: opts.transparent ?? false, ...(type === 'jpeg' ? { quality: 90 } : {}) });
    return out;
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}
