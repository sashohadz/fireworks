// Measures what Firework does to this store's pages, for /lab/performance. For every page in src/lib/perf.ts and
// every combination of its widgets (?widgets= picks them), with standard loading and with the lazy loader, plus each
// page without Firework:
//
// 1. Lighthouse with real (devtools) throttling: a slow 4G connection, 4x CPU slowdown, Moto G Power emulation and
//    an empty cache. Metrics, the loading filmstrip (as small WebP files under public/perf/) and the request
//    timeline all come from the same slowed-down load. Median of --runs runs (default 3).
// 2. Page maps: the whole page with Firework on, as a phone shows it, and where each widget sits.
// 3. The lazy trade-off: on a throttled phone, how long after the shopper scrolls to the first widget below the
//    first screen its first thumbnail shows, with the lazy loader and with standard loading.
//
// Usage: BASE_URL=https://deploy-preview-12--fjordbloom.netlify.app npm run perf:measure
//   --runs 3        Lighthouse runs per setup and mode
//   --only product  one page (product, category or home); other pages keep their previous results
//   --setups product--pdp,product--off   only these setups (for quick checks); the others keep their results
//   --from-raw      rebuild the JSON and filmstrips from the saved reports in out/perf/, without measuring
//   --resume        reuse every saved report of this connection and measure only the missing runs (after an
//                   interrupted run, e.g. a laptop that had to sleep)
//   --skip-maps / --skip-reveal   keep the previous page maps / lazy trade-off numbers
//   --maps-only     only the page maps (and the lazy trade-off unless --skip-reveal); Lighthouse results are kept
//   --profile fast4g   measure on Chrome's Fast 4G instead of Lighthouse's slow 4G; the other connection's results stay.
//                   Same phone and CPU. Page maps are not retaken (same screen); raw reports and filmstrips go apart.
//   --baseline https://fjordbloom.netlify.app   measure only the pages without Firework on that site, the same way,
//                   and store them as the "before" for the store's own fixes; everything else is kept
// Firework's tracking pixel is blocked, so the runs don't count as visits in the sandbox channel's Insights.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';
import {
  PHONE,
  REVEAL_AFTER_MS,
  netOf,
  netProfiles,
  groupOfHost,
  perfPages,
  perfSetups,
  setupModes,
  setupUrl,
  type FwMode,
  type GroupTotals,
  type LaneId,
  type NetProfile,
  type PageMap,
  type PerfGroup,
  type PerfReport,
  type PerfResult,
  type PerfSetup,
  type Placement,
  type Reveal,
} from '../../src/lib/perf';

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const base = (process.env.BASE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '');
const runs = Math.max(1, Number(arg('--runs')) || 3);
const only = arg('--only') ?? null;
const onlySetups = arg('--setups')?.split(',').filter(Boolean) ?? null;
/** --modes head: measure only these modes for the chosen setups, keeping their other modes' results. */
const onlyModes = arg('--modes')?.split(',').filter((m): m is FwMode => ['off', 'on', 'lazy', 'head'].includes(m)) ?? null;
const modesFor = (s: PerfSetup): FwMode[] =>
  !onlyModes ? setupModes(s) : s.off ? setupModes(s).filter((m) => onlyModes.includes(m)) : onlyModes.filter((m) => m !== 'off');
const baselineSite = arg('--baseline')?.replace(/\/$/, '') ?? null;
const fromRaw = process.argv.includes('--from-raw');
const resume = process.argv.includes('--resume');
const mapsOnly = process.argv.includes('--maps-only');
const net: NetProfile = arg('--profile') === 'fast4g' ? 'fast4g' : 'slow4g';
const NET = netProfiles[net];
/** Slow 4G keeps the original file names; Fast 4G gets a prefix and its own filmstrip folder. */
const rawPrefix = net === 'slow4g' ? '' : `${net}--`;
const filmRoot = net === 'slow4g' ? '' : `${net}/`;
// The page maps don't depend on the connection: same screen, same layout.
const skipMaps = fromRaw || net !== 'slow4g' || process.argv.includes('--skip-maps');
const skipReveal = fromRaw || process.argv.includes('--skip-reveal');
const OUT = path.resolve('src/data/perf/latest.json');
const RAW = path.resolve('out/perf');
const PUBLIC_PERF = path.resolve('public/perf');
const FILM_WIDTH = 140;
const MAP_WIDTH = 180;
/**
 * Netlify injects its deploy-preview toolbar (the Netlify Drawer) into every page of a deploy preview: a same-origin
 * loader, then scripts, fonts and 1.3 MB of promo videos from app.netlify.com, plus Segment and Bugsnag. Production
 * has none of it, so it is blocked everywhere, together with Firework's tracking pixel.
 */
const BLOCKED = ['*/trk/*', '*/.netlify/scripts/cdp*', '*app.netlify.com/*', '*cdn.segment.com/*', '*bugsnag.com/*'];
const BLOCKED_RE = /\/trk\/|\/\.netlify\/scripts\/cdp|app\.netlify\.com|cdn\.segment\.com|bugsnag\.com/;

/** Lighthouse's throttling settings for the chosen connection: same phone and CPU, only the network differs. */
const THROTTLING = {
  rttMs: NET.rttMs,
  throughputKbps: NET.downKbps / 0.9,
  requestLatencyMs: NET.latencyMs,
  downloadThroughputKbps: NET.downKbps,
  uploadThroughputKbps: NET.upKbps,
  cpuSlowdownMultiplier: 4,
};

/** The parts of a Lighthouse result this script reads. */
interface Lhr {
  requestedUrl?: string;
  lighthouseVersion: string;
  environment: { hostUserAgent: string };
  categories: { performance: { score: number | null } };
  audits: Record<string, { numericValue?: number; scoreDisplayMode?: string; details?: { items?: Record<string, unknown>[] } }>;
}

interface Run {
  lighthouse: PerfResult['lighthouse'];
  network: PerfResult['network'];
  runtime: PerfResult['runtime'];
  lanes: NonNullable<PerfResult['lanes']>;
  frames: { t: number; data: string }[];
}

const num = (lhr: Lhr, id: string) => lhr.audits[id]?.numericValue ?? 0;
const items = (lhr: Lhr, id: string) => lhr.audits[id]?.details?.items ?? [];
const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};
const laneOf = (g: PerfGroup): LaneId =>
  g === 'site' ? 'page' : g === 'firework-sdk' ? 'script' : g === 'firework-media' || g === 'livestream' ? 'media' : g === 'ava' ? 'ava' : 'tracking';

/** Overlapping (or nearly touching) request intervals merged into one bar. */
function merge(intervals: [number, number][]): [number, number][] {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 40) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => [Math.round(a), Math.round(b)]);
}

function summarise(lhr: Lhr): Run {
  // The site is whatever host the report was measured on, so saved reports re-summarise anywhere.
  const siteHosts = [...new Set([hostOf(lhr.requestedUrl ?? ''), new URL(base).host].filter(Boolean))];
  const groups: Partial<Record<PerfGroup, GroupTotals>> = {};
  const types: Record<string, number> = {};
  const add = (g: PerfGroup) => (groups[g] ??= { requests: 0, bytes: 0, scriptMs: 0 });
  const requests = items(lhr, 'network-requests').filter((r) => typeof r.url === 'string' && !String(r.url).startsWith('data:'));
  const fw: { url: string; bytes: number; type: string }[] = [];
  const laneIntervals: Partial<Record<LaneId, [number, number][]>> = {};
  let videoBytes = 0;
  for (const r of requests) {
    const url = String(r.url);
    const bytes = Number(r.transferSize ?? 0);
    const type = String(r.resourceType ?? 'Other');
    const g = groupOfHost(hostOf(url), siteHosts);
    const t = add(g);
    t.requests++;
    t.bytes += bytes;
    types[type] = (types[type] ?? 0) + bytes;
    // Lighthouse types the streamed video files (watermarked 720p MP4) as Media.
    if (type === 'Media' && g !== 'site') videoBytes += bytes;
    if (g !== 'site') fw.push({ url, bytes, type });
    const start = Number(r.networkRequestTime ?? NaN);
    const end = Number(r.networkEndTime ?? NaN);
    if (Number.isFinite(start) && Number.isFinite(end)) (laneIntervals[laneOf(g)] ??= []).push([start, end]);
  }
  for (const b of items(lhr, 'bootup-time')) {
    // Script execution and parse only. "total" also counts layout and paint attributed to the document.
    const g = groupOfHost(hostOf(String(b.url)), siteHosts);
    add(g).scriptMs += Number(b.scripting ?? 0) + Number(b.scriptParseCompile ?? 0);
  }
  const shifts = items(lhr, 'layout-shifts')
    .map((it) => ({ selector: String((it.node as { selector?: string } | undefined)?.selector ?? '?'), score: Number(it.score ?? 0) }))
    .filter((x) => x.score > 0)
    .slice(0, 3);
  // Lighthouse's long-task list and blocking time need the page to settle. When a playing video keeps the network
  // busy past maxWaitForLoad, both come back empty ("took too long to load"), which would read as no pauses at all.
  // main-thread-tasks still lists every top-level task, so pauses come from there. Tasks that started before the
  // navigation (negative start time) belong to the previous page, not this one.
  const tasks = items(lhr, 'main-thread-tasks')
    .map((t) => ({ startTime: Number(t.startTime ?? 0), duration: Number(t.duration ?? 0) }))
    .filter((t) => t.startTime >= 0);
  const longTasks = tasks.filter((t) => t.duration >= 50);
  const settled = lhr.audits['total-blocking-time']?.scoreDisplayMode !== 'error';
  const fcp = num(lhr, 'first-contentful-paint');
  // Without Lighthouse's figure: the same sum (each long task's time over 50 ms, after the first paint) up to the trace end.
  const tbt = settled ? num(lhr, 'total-blocking-time') : longTasks.filter((t) => t.startTime >= fcp).reduce((a, t) => a + Math.max(0, t.duration - 50), 0);
  // The element Lighthouse took as the largest contentful paint, and whether Firework rendered it.
  const lcpNode = items(lhr, 'lcp-breakdown-insight').find((it) => it.type === 'node') as { selector?: string; path?: string } | undefined;
  const lcpElement = lcpNode ? { selector: String(lcpNode.selector ?? '?'), firework: /FW-[A-Z-]+/.test(String(lcpNode.path ?? '')) } : undefined;
  const frames = items(lhr, 'screenshot-thumbnails').map((f) => ({ t: Math.round(Number(f.timing ?? 0)), data: String(f.data ?? '') }));
  const lanes: Run['lanes'] = {};
  for (const [lane, intervals] of Object.entries(laneIntervals)) lanes[lane as LaneId] = merge(intervals);
  return {
    lighthouse: {
      score: Math.round((lhr.categories.performance.score ?? 0) * 100),
      lcp: num(lhr, 'largest-contentful-paint'),
      fcp,
      cls: num(lhr, 'cumulative-layout-shift'),
      tbt,
      ...(settled ? {} : { tbtFromTrace: true }),
      si: num(lhr, 'speed-index'),
      tti: num(lhr, 'interactive'),
    },
    network: {
      requests: requests.length,
      bytes: requests.reduce((a, r) => a + Number(r.transferSize ?? 0), 0),
      videoBytes,
      groups,
      types,
      biggest: fw.sort((a, b) => b.bytes - a.bytes).slice(0, 8),
    },
    runtime: {
      // Lighthouse 13 moved DOM size to an insight audit.
      domNodes: num(lhr, 'dom-size-insight') || num(lhr, 'dom-size'),
      longTasks: longTasks.length,
      longTaskMs: longTasks.reduce((a, t) => a + t.duration, 0),
      longestTaskMs: Math.max(0, ...longTasks.map((t) => t.duration)),
      mainThreadMs: num(lhr, 'mainthread-work-breakdown'),
      // The module build loads chunks under /js/module/chunks/; the lazy loader fetches the legacy /js/fwn.js build.
      sdkLoaded: requests.some((r) => /asset\.fwcdn3\.com\/js\/(module\/chunks\/|chunks\/|fwn\.js$)/.test(String(r.url))),
      shifts,
      lcpElement,
    },
    lanes,
    frames,
  };
}

/** The run in the middle by performance score, so every number in a result comes from one real run. */
function median(all: Run[]): Run {
  const sorted = [...all].sort((a, b) => a.lighthouse.score - b.lighthouse.score || a.lighthouse.lcp - b.lighthouse.lcp);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

const span = (values: number[]): [number, number] => [Math.min(...values), Math.max(...values)];
const ranges = (all: Run[]): PerfResult['ranges'] => ({
  lcp: span(all.map((r) => r.lighthouse.lcp)),
  tbt: span(all.map((r) => r.lighthouse.tbt)),
  bytes: span(all.map((r) => r.network.bytes)),
  videoBytes: span(all.map((r) => r.network.videoBytes ?? 0)),
  longest: span(all.map((r) => r.runtime.longestTaskMs)),
});

/** The filmstrip of the middle run as small WebP files: public/perf/<setup>-<mode>/film-<n>.webp. */
async function writeFilm(setup: string, mode: FwMode, frames: Run['frames']): Promise<PerfResult['film']> {
  const dir = path.join(PUBLIC_PERF, `${filmRoot}${setup}-${mode}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const out: NonNullable<PerfResult['film']> = [];
  for (const [i, f] of frames.entries()) {
    const b64 = f.data.split(',', 2)[1];
    if (!b64) continue;
    const file = path.join(dir, `film-${i}.webp`);
    await sharp(Buffer.from(b64, 'base64')).resize({ width: FILM_WIDTH }).webp({ quality: 60 }).toFile(file);
    out.push({ t: f.t, src: `/perf/${filmRoot}${setup}-${mode}/film-${i}.webp` });
  }
  return out;
}

async function sdkRelease(): Promise<string> {
  try {
    const text = await (await fetch('https://asset.fwcdn3.com/js/module/fwn.js')).text();
    return /Release:\s*(\S+)/.exec(text)?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const widgetSelector = (key: string) => (key === 'ava' ? 'fw-ava' : `[data-fw-key="${key}"], [data-fw-slot="${key}"]:not([data-fw-key])`);
const widgetLabel = (setup: PerfSetup, key: string) => perfPages.find((p) => p.id === setup.page)?.widgets.find((w) => w.key === key)?.label ?? key;

// ---------- 2. page maps ----------

async function pageMap(page: Page, setup: PerfSetup): Promise<PageMap> {
  const mode: FwMode = setup.off ? 'off' : 'on';
  await page.goto(`${base}${setupUrl(setup, mode)}`, { waitUntil: 'load' });
  // The floating lab notice ("Only these widgets…") is demo chrome, not part of the page a shopper sees.
  await page.addStyleTag({ content: '#override-banner { display: none !important; }' });
  await page.waitForTimeout(setup.off ? 1500 : 7000);
  const boxes = await page.evaluate(
    ({ keys, selectors }) =>
      keys.flatMap((key, i) => {
        const el = document.querySelector<HTMLElement>(selectors[i]!);
        if (!el) return [];
        // The reserved space around a widget, or the widget itself (AVA, the floating player).
        const box = el.parentElement?.classList.contains('fw-reserve') ? el.parentElement : el;
        const r = box.getBoundingClientRect();
        const fixed = key === 'floating';
        return [{ key, top: Math.round(r.top + (fixed ? 0 : window.scrollY)), height: Math.round(r.height), left: Math.round(r.left), width: Math.round(r.width), fixed }];
      }),
    { keys: setup.widgets, selectors: setup.widgets.map(widgetSelector) },
  );
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const shot = await page.screenshot({ fullPage: true, type: 'png' });
  const dir = path.join(PUBLIC_PERF, setup.id);
  fs.mkdirSync(dir, { recursive: true });
  await sharp(shot).resize({ width: MAP_WIDTH }).webp({ quality: 55 }).toFile(path.join(dir, 'page.webp'));
  return { src: `/perf/${setup.id}/page.webp`, height, boxes: boxes.map((b) => ({ ...b, label: widgetLabel(setup, b.key) })) };
}

// ---------- 3. the lazy trade-off ----------

/** Has the widget shown a thumbnail or a playing video? Looks through open shadow roots. */
const rendered = (selector: string) =>
  `(() => {
    const host = document.querySelector(${JSON.stringify(selector)});
    if (!host || !customElements.get(host.tagName.toLowerCase())) return false;
    const seen = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        if (el.tagName === 'IMG' || el.tagName === 'VIDEO') seen.push(el);
      }
    };
    if (host.shadowRoot) walk(host.shadowRoot);
    return seen.some((m) => {
      const r = m.getBoundingClientRect();
      const ready = m.tagName === 'IMG' ? m.complete && m.naturalWidth > 0 : m.readyState >= 2;
      return ready && r.width > 20 && r.height > 20;
    });
  })()`;

async function timeReveal(page: Page, setup: PerfSetup, mode: FwMode, key: string): Promise<number | null> {
  await page.goto(`${base}${setupUrl(setup, mode)}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(REVEAL_AFTER_MS);
  const selector = widgetSelector(key);
  const started = Date.now();
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), selector);
  while (Date.now() - started < 25000) {
    if (await page.evaluate(rendered(selector))) return Date.now() - started;
    await page.waitForTimeout(100);
  }
  return null;
}

/** A phone-sized page on this run's connection, with 4x CPU slowdown, as in the Lighthouse runs. */
async function throttledPage(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
  await ctx.route(BLOCKED_RE, (r) => r.abort());
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: NET.latencyMs,
    downloadThroughput: (NET.downKbps * 1024) / 8,
    uploadThroughput: (NET.upKbps * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return { page, close: () => ctx.close() };
}

/** From navigation start until a widget in the first screen shows its first thumbnail or video, in the page's own clock. */
async function timeAppear(page: Page, setup: PerfSetup, mode: FwMode, key: string): Promise<number | null> {
  const check = `(() => (${rendered(widgetSelector(key))} ? performance.now() : 0))()`;
  const started = Date.now();
  await page.goto(`${base}${setupUrl(setup, mode)}`, { waitUntil: 'commit', timeout: 60000 });
  while (Date.now() - started < 30000) {
    // The page may still be navigating; a failed check just means "not yet".
    const at = (await page.evaluate(check).catch(() => 0)) as number;
    if (at > 0) return Math.round(at);
    await page.waitForTimeout(100);
  }
  return null;
}

/** Tag at the end of the page against tag in the head: when the first-screen widget shows its videos. 3 runs each. */
async function placementTimes(setup: PerfSetup, map: PageMap | undefined): Promise<Placement[]> {
  const first = (map?.boxes ?? []).filter((b) => b.key !== 'ava' && !b.fixed && b.top < PHONE.height).sort((a, b) => a.top - b.top)[0];
  if (!first) return [];
  const browser = await chromium.launch();
  const median = (xs: number[]) => (xs.length ? xs.sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]! : null);
  try {
    const times = async (mode: FwMode) => {
      const out: number[] = [];
      for (let i = 0; i < 3; i++) {
        const { page, close } = await throttledPage(browser);
        try {
          const ms = await timeAppear(page, setup, mode, first.key);
          if (ms !== null) out.push(ms);
        } finally {
          await close();
        }
      }
      return median(out);
    };
    return [{ profile: net, widget: first.label, endMs: await times('on'), headMs: await times('head') }];
  } finally {
    await browser.close();
  }
}

async function reveals(setup: PerfSetup, map: PageMap | undefined): Promise<Reveal[]> {
  // The first widget below the first screen, the one a scrolling shopper reaches first. AVA is not lazy-loaded.
  const below = (map?.boxes ?? []).filter((b) => b.key !== 'ava' && (b.fixed || b.top > PHONE.height)).sort((a, b) => a.top - b.top)[0];
  if (!below) return [];
  const browser = await chromium.launch();
  try {
    const time = async (mode: FwMode) => {
      const { page, close } = await throttledPage(browser);
      try {
        return await timeReveal(page, setup, mode, below.key);
      } finally {
        await close();
      }
    };
    const lazy: number[] = [];
    for (let i = 0; i < 3; i++) {
      const ms = await time('lazy');
      if (ms !== null) lazy.push(ms);
    }
    const standard = await time('on');
    if (!lazy.length) return [];
    lazy.sort((a, b) => a - b);
    return [{ profile: net, widget: below.label, lazyMs: lazy[Math.floor((lazy.length - 1) / 2)]!, standardMs: standard ?? 0 }];
  } finally {
    await browser.close();
  }
}

// ---------- main ----------

/** Lighthouse with the same settings as the main runs, on any URL. */
async function measureUrl(port: number, url: string, file: string): Promise<Lhr> {
  const result = await lighthouse(url, {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance'],
    // Real throttling, so the filmstrip and the timeline show the same slowed-down load as the metrics.
    throttlingMethod: 'devtools',
    throttling: THROTTLING,
    // A playing video keeps the network busy; the metrics are settled long before this.
    maxWaitForLoad: 30000,
    // Firework's tracking events and Netlify's deploy-preview toolbar. Everything else loads as it would for a visitor.
    blockedUrlPatterns: BLOCKED,
  });
  if (!result) throw new Error('Lighthouse returned nothing');
  fs.writeFileSync(file, String(result.report));
  return result.lhr as unknown as Lhr;
}

/** The pages without Firework on another site, as the "before" of the store's own fixes. */
async function measureBaseline(site: string): Promise<void> {
  if (!fs.existsSync(OUT)) throw new Error('Run the main measurement first: the baseline is added to its results.');
  const report = JSON.parse(fs.readFileSync(OUT, 'utf8')) as PerfReport;
  const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--disable-gpu'] });
  const results: PerfResult[] = [];
  try {
    for (const setup of perfSetups().filter((s) => s.off)) {
      const all: Run[] = [];
      for (let i = 0; i < runs; i++) {
        process.stdout.write(`baseline ${setup.id} run ${i + 1}/${runs} … `);
        const lhr = await measureUrl(chrome.port, `${site}${setupUrl(setup, 'off')}`, path.join(RAW, `baseline-${setup.id}-${i + 1}.json`));
        const run = summarise(lhr);
        all.push(run);
        console.log(`LCP ${Math.round(run.lighthouse.lcp)} ms, ${Math.round(run.network.bytes / 1024)} KB`);
      }
      const { frames: _frames, ...rest } = median(all);
      rest.runtime = { ...rest.runtime, longestTaskMs: Math.min(...all.map((r) => r.runtime.longestTaskMs)) };
      results.push({ setup: setup.id, mode: 'off', url: setupUrl(setup, 'off'), ...rest, runs: all.length, ranges: ranges(all) });
    }
  } finally {
    await chrome.kill();
  }
  report.baseline = { site, measuredAt: new Date().toISOString(), results };
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nAdded the baseline of ${site} to ${path.relative(process.cwd(), OUT)}.`);
}

async function main(): Promise<void> {
  fs.mkdirSync(RAW, { recursive: true });
  if (baselineSite) return measureBaseline(baselineSite);
  const setups = perfSetups().filter((s) => (!only || s.page === only) && (!onlySetups || onlySetups.includes(s.id)));
  if (!setups.length) throw new Error('No setups match --only / --setups. Pages: product, category, home.');
  let chrome: Awaited<ReturnType<typeof launch>> | null = null;
  if (!fromRaw && !mapsOnly) {
    for (const page of perfPages) {
      const res = await fetch(`${base}${page.path}`).catch(() => null);
      if (!res?.ok) throw new Error(`${base}${page.path} did not answer. Set BASE_URL to the site to measure.`);
    }
    chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--disable-gpu'] });
  }
  const previous = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, 'utf8')) as Partial<PerfReport>) : null;
  const results: PerfResult[] = [];
  let lhVersion = '';
  let chromeUa = '';
  let measuredSite = '';
  try {
    for (const setup of mapsOnly ? [] : setups) {
      for (const mode of modesFor(setup)) {
        const url = `${base}${setupUrl(setup, mode)}`;
        const all: Run[] = [];
        const saved = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter((f) => f.startsWith(`${rawPrefix}${setup.id}-${mode}-`) && f.endsWith('.json')).length : 0;
        const count = fromRaw ? saved : runs;
        for (let i = 0; i < count; i++) {
          const file = path.join(RAW, `${rawPrefix}${setup.id}-${mode}-${i + 1}.json`);
          process.stdout.write(`${NET.label} ${setup.id} ${mode} run ${i + 1}/${count}${fromRaw || (resume && fs.existsSync(file)) ? ' (saved)' : ''} … `);
          let lhr: Lhr;
          if (fromRaw || (resume && fs.existsSync(file))) {
            lhr = JSON.parse(fs.readFileSync(file, 'utf8')) as Lhr;
          } else {
            lhr = await measureUrl(chrome!.port, url, file);
          }
          lhVersion = lhr.lighthouseVersion;
          chromeUa = lhr.environment.hostUserAgent;
          if (lhr.requestedUrl) measuredSite = new URL(lhr.requestedUrl).origin;
          const run = summarise(lhr);
          all.push(run);
          console.log(`LCP ${Math.round(run.lighthouse.lcp)} ms, TBT ${Math.round(run.lighthouse.tbt)} ms, ${run.network.requests} requests, ${Math.round(run.network.bytes / 1024)} KB`);
        }
        if (!all.length) throw new Error(`No saved reports for ${setup.id} ${mode} in ${path.relative(process.cwd(), RAW)}`);
        const mid = median(all);
        const { frames, ...rest } = mid;
        // Pauses are CPU-bound, and other programs on the test machine lengthen them at random. The shortest across
        // the runs is the least disturbed; it is used the same way for every variant.
        rest.runtime = { ...rest.runtime, longestTaskMs: Math.min(...all.map((r) => r.runtime.longestTaskMs)) };
        results.push({ setup: setup.id, mode, profile: net, url: setupUrl(setup, mode), ...rest, film: await writeFilm(setup.id, mode, frames), runs: all.length, ranges: ranges(all) });
      }
    }
  } finally {
    await chrome?.kill();
  }

  // Page maps and the lazy trade-off: kept from the previous file unless measured now.
  const pageMaps: Record<string, PageMap> = { ...(previous?.pageMaps ?? {}) };
  const revealMap: Record<string, Reveal[]> = { ...(previous?.reveals ?? {}) };
  const placementMap: Record<string, Placement[]> = { ...(previous?.placement ?? {}) };
  if (onlyModes?.includes('head') && !fromRaw && !process.argv.includes('--skip-placement')) {
    for (const setup of setups.filter((s) => !s.off && s.widgets.length)) {
      process.stdout.write(`tag placement ${setup.id} … `);
      const found = await placementTimes(setup, pageMaps[setup.id]);
      placementMap[setup.id] = [...(placementMap[setup.id] ?? []).filter((r) => netOf(r) !== net), ...found];
      console.log(found.map((p) => `${p.widget}: end of page ${p.endMs} ms, head ${p.headMs} ms`).join('; ') || 'no widget in the first screen');
    }
  }
  if (!skipMaps) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await ctx.route(BLOCKED_RE, (r) => r.abort());
    const page = await ctx.newPage();
    for (const setup of setups) {
      process.stdout.write(`page map ${setup.id} … `);
      pageMaps[setup.id] = await pageMap(page, setup);
      console.log(`${pageMaps[setup.id]!.height}px, ${pageMaps[setup.id]!.boxes.length} widgets`);
    }
    await browser.close();
  }
  if (!skipReveal) {
    for (const setup of setups.filter((s) => !s.off && s.widgets.length)) {
      process.stdout.write(`lazy trade-off ${setup.id} … `);
      // One entry per connection: replace this connection's, keep the other's.
      revealMap[setup.id] = [...(revealMap[setup.id] ?? []).filter((r) => netOf(r) !== net), ...(await reveals(setup, pageMaps[setup.id]))];
      console.log(revealMap[setup.id]!.map((r) => `${r.widget}: lazy ${r.lazyMs} ms, standard ${r.standardMs} ms`).join('; ') || 'nothing below the first screen');
    }
  }

  // Keep the other connection's results, and with --only, --setups or --maps-only also this connection's others.
  const prev = (previous?.results ?? []).filter((r) => r.setup);
  const kept = [
    ...prev.filter((r) => netOf(r) !== net),
    ...(mapsOnly
      ? prev.filter((r) => netOf(r) === net)
      : only || onlySetups
        ? prev.filter((r) => netOf(r) === net && (!setups.some((s) => s.id === r.setup) || (onlyModes !== null && !onlyModes.includes(r.mode))))
        : []),
  ];
  const order = perfSetups().map((s) => s.id);
  const allResults = [...kept, ...results].sort(
    (a, b) => netOf(a).localeCompare(netOf(b)) * -1 || order.indexOf(a.setup) - order.indexOf(b.setup) || a.mode.localeCompare(b.mode),
  );
  const report: PerfReport = {
    // Re-summarised reports keep the date they were measured.
    measuredAt: (fromRaw || mapsOnly) && previous?.measuredAt ? previous.measuredAt : new Date().toISOString(),
    site: fromRaw ? measuredSite || base : mapsOnly && previous?.site ? previous.site : base,
    sdkRelease: await sdkRelease(),
    lighthouseVersion: lhVersion || previous?.lighthouseVersion || '',
    chrome: /Chrome\/([\d.]+)/.exec(chromeUa)?.[1] ?? (chromeUa || previous?.chrome || ''),
    conditions: {
      device: 'Mid-range phone (Moto G Power, Lighthouse mobile profile)',
      network: 'Slow 4G (1.6 Mbps, 150 ms round trip) and Chrome’s Fast 4G (9 Mbps, 60 ms), applied for real',
      cpu: '4x slower than this computer',
      cache: 'First visit: empty cache',
      tracking: "Firework's tracking pixel blocked, so the runs are not counted as visits",
      runs: Math.max(...allResults.map((r) => r.runs)),
    },
    pages: perfPages,
    setups: perfSetups(),
    results: allResults,
    pageMaps,
    reveals: revealMap,
    ...(Object.keys(placementMap).length ? { placement: placementMap } : {}),
    // The baseline is measured separately (--baseline) and kept.
    ...(previous?.baseline ? { baseline: previous.baseline } : {}),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT)}: ${allResults.length} results, ${Object.keys(pageMaps).length} page maps.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
