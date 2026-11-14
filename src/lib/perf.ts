// Shared by the measurement script (scripts/perf/measure.ts), /lab/performance and the bookmark's report page.
// Safe to import from client code: no filesystem access.

export type FwMode = 'off' | 'lazy' | 'on';

/** Who a request belongs to, by host. */
export type PerfGroup = 'site' | 'firework-sdk' | 'firework-media' | 'firework-api' | 'ava' | 'livestream' | 'other';

export const groupLabels: Record<PerfGroup, string> = {
  site: 'The site itself',
  'firework-sdk': 'Firework SDK (scripts)',
  'firework-media': 'Firework media (thumbnails, previews, video)',
  'firework-api': 'Firework API and analytics',
  ava: 'AVA',
  livestream: 'Livestream player',
  other: 'Other',
};

export const groupOrder: PerfGroup[] = ['site', 'firework-sdk', 'firework-media', 'firework-api', 'ava', 'livestream', 'other'];

export function groupOfHost(host: string, siteHosts: string[]): PerfGroup {
  const h = host.toLowerCase();
  if (siteHosts.includes(h) || h === 'fjordbloom.netlify.app') return 'site';
  if (h === 'asset.fwcdn3.com' || /^asset\.(fwcdn\d|fwpub\d|fireworktv|fireworkn)\.com$/.test(h)) return 'firework-sdk';
  if (h === 'asset.fwscripts.com') return 'ava';
  if (/^cdn\d+-api\.fireworktv\.com$/.test(h)) return 'firework-api';
  if (/^cdn\d*\.fireworktv\.com$/.test(h) || /fireworkvideo|fwcdn\d\.com$/.test(h)) return 'firework-media';
  if (/fireworkapi|fireworkanalytics|fwpixel|fireworkadservices|fireworkbiz|fwbiz/.test(h)) return 'firework-api';
  if (/live-video\.net$|ivs/.test(h)) return 'livestream';
  return 'other';
}

/**
 * Google's Core Web Vitals thresholds (p75 of real visits) and Lighthouse's lab thresholds.
 * https://web.dev/articles/vitals and https://developer.chrome.com/docs/lighthouse/performance/
 */
export interface Threshold {
  id: string;
  label: string;
  unit: 'ms' | 's' | 'score' | 'count';
  good: number;
  poor: number;
  /** Lab (Lighthouse) or field (Core Web Vital). */
  kind: 'vital' | 'lab';
  about: string;
}

export const thresholds: Threshold[] = [
  { id: 'lcp', label: 'Largest Contentful Paint', unit: 'ms', good: 2500, poor: 4000, kind: 'vital', about: 'When the biggest image or text block has painted.' },
  { id: 'inp', label: 'Interaction to Next Paint', unit: 'ms', good: 200, poor: 500, kind: 'vital', about: 'How long the page takes to respond to taps and clicks. Only measurable with real visitors.' },
  { id: 'cls', label: 'Cumulative Layout Shift', unit: 'score', good: 0.1, poor: 0.25, kind: 'vital', about: 'How much the layout jumps around while loading.' },
  { id: 'fcp', label: 'First Contentful Paint', unit: 'ms', good: 1800, poor: 3000, kind: 'lab', about: 'When the first text or image paints.' },
  { id: 'tbt', label: 'Total Blocking Time', unit: 'ms', good: 200, poor: 600, kind: 'lab', about: 'Main-thread time during load when the page cannot respond. The lab stand-in for INP.' },
  { id: 'si', label: 'Speed Index', unit: 'ms', good: 3400, poor: 5800, kind: 'lab', about: 'How quickly the visible page fills in.' },
];

export type Rating = 'good' | 'needs-improvement' | 'poor';

export function rate(id: string, value: number): Rating {
  const t = thresholds.find((x) => x.id === id);
  if (!t) return 'good';
  return value <= t.good ? 'good' : value <= t.poor ? 'needs-improvement' : 'poor';
}

export const ratingLabels: Record<Rating, string> = { good: 'Good', 'needs-improvement': 'Needs improvement', poor: 'Poor' };

/** A widget the performance view can switch on, by its ?widgets= key (see WIDGET_KEYS in settings.ts). */
export interface PerfWidget {
  key: string;
  label: string;
}

export type PerfPageId = 'product' | 'category' | 'home';

/** A page of this store, with the widgets that can be switched on there. */
export interface PerfPage {
  id: PerfPageId;
  label: string;
  /** Path with a trailing slash. */
  path: string;
  widgets: PerfWidget[];
  /** What the view starts with on this page. */
  defaults: string[];
}

export const perfPages: PerfPage[] = [
  {
    id: 'product',
    label: 'Product page',
    path: '/products/cloudberry-vitamin-c-serum/',
    widgets: [
      { key: 'pdp', label: 'Storyblock' },
      { key: 'deck', label: 'Player Deck' },
      { key: 'ava', label: 'AVA' },
    ],
    defaults: ['pdp'],
  },
  {
    id: 'category',
    label: 'Category page',
    path: '/shop/',
    widgets: [
      { key: 'stories', label: 'Circle stories' },
      { key: 'grid', label: 'Video grid' },
    ],
    defaults: ['grid'],
  },
  {
    id: 'home',
    label: 'Home page',
    path: '/',
    widgets: [
      { key: 'carousel', label: 'Carousel' },
      { key: 'floating', label: 'Floating player' },
    ],
    defaults: [],
  },
];

/**
 * One measured setup: a page with a set of widgets, or the page without Firework ("off"). With no widgets but
 * Firework on, the page still loads the script: what a site-wide script tag costs on pages without widgets.
 */
export interface PerfSetup {
  id: string;
  page: PerfPageId;
  /** Widget keys, in the page's order. Empty for "script only" and for "off". */
  widgets: string[];
  off: boolean;
}

/** "product--pdp-ava", "product--none" (script only), "product--off" (no Firework). */
export const setupId = (page: PerfPageId, widgets: string[] | null): string =>
  `${page}--${widgets === null ? 'off' : widgets.length ? widgets.join('-') : 'none'}`;

/** Every subset of a page's widgets, in the page's order, the empty set first. */
export function widgetCombos(page: PerfPage): string[][] {
  const keys = page.widgets.map((w) => w.key);
  const out: string[][] = [];
  for (let mask = 0; mask < 1 << keys.length; mask++) out.push(keys.filter((_, i) => mask & (1 << i)));
  return out.sort((a, b) => a.length - b.length);
}

export function perfSetups(): PerfSetup[] {
  return perfPages.flatMap((p) => [
    { id: setupId(p.id, null), page: p.id, widgets: [], off: true },
    ...widgetCombos(p).map((w) => ({ id: setupId(p.id, w), page: p.id, widgets: w, off: false })),
  ]);
}

/** Modes measured for a setup: "off" for the page without Firework, standard ("on") and lazy for the others. */
export const setupModes = (s: PerfSetup): FwMode[] => (s.off ? ['off'] : ['on', 'lazy']);

/** The URL a setup is measured at. */
export function setupUrl(s: PerfSetup, mode: FwMode): string {
  const page = perfPages.find((p) => p.id === s.page)!;
  return `${page.path}?widgets=${s.widgets.join(',')}&fw=${mode}`;
}

export const modeLabels: Record<FwMode, string> = {
  off: 'Without Firework',
  lazy: 'Lazy loading',
  on: 'Standard loading',
};

export interface GroupTotals {
  requests: number;
  /** Transferred bytes (compressed). */
  bytes: number;
  /** Script execution and parse time from Lighthouse's bootup-time audit (not layout or paint). */
  scriptMs: number;
}

/** Where requests happened on the loading timeline, merged per lane, in ms from the start of navigation. */
export type LaneId = 'page' | 'script' | 'media' | 'tracking' | 'ava';

export const laneLabels: Record<LaneId, string> = {
  page: 'Your page',
  script: 'Firework script',
  media: 'Thumbnails and video',
  tracking: 'Tracking and API',
  ava: 'AVA',
};

export interface PerfResult {
  setup: string;
  mode: FwMode;
  url: string;
  lighthouse: {
    score: number;
    lcp: number;
    fcp: number;
    cls: number;
    tbt: number;
    si: number;
    tti: number;
  };
  network: {
    requests: number;
    /** All transferred bytes, including video that started playing during the run. */
    bytes: number;
    /**
     * Video files that streamed because a video started playing (autoplay). Whether one starts within the run
     * varies, so setups are compared on bytes minus these, and video is shown on its own.
     */
    videoBytes?: number;
    groups: Partial<Record<PerfGroup, GroupTotals>>;
    types: Record<string, number>;
    /** The biggest Firework requests, for the "what is it" table. */
    biggest: { url: string; bytes: number; type: string }[];
  };
  runtime: {
    domNodes: number;
    longTasks: number;
    longTaskMs: number;
    /** The longest single pause: what a tap during loading could wait for. */
    longestTaskMs: number;
    /** Total main-thread work during load. */
    mainThreadMs: number;
    sdkLoaded: boolean;
    /** The elements that moved, biggest first, with their share of CLS. */
    shifts?: { selector: string; score: number }[];
    /** The element Lighthouse took as the largest contentful paint, and whether Firework rendered it. */
    lcpElement?: { selector: string; firework: boolean };
  };
  /** Loading filmstrip of the middle run: frame times in ms and their image under public/. */
  film?: { t: number; src: string }[];
  /** Request lanes of the middle run, for the timeline. */
  lanes?: Partial<Record<LaneId, [number, number][]>>;
  /** Number of runs this result is the median of. */
  runs: number;
  /** Lowest and highest value across the runs, to tell a real change from run-to-run noise. */
  ranges?: { lcp: [number, number]; tbt: [number, number]; bytes: [number, number]; videoBytes?: [number, number]; longest?: [number, number] };
}

/** The whole page as a phone shows it, with where each widget sits. Taken with Firework on, unthrottled. */
export interface PageMap {
  /** Full-page screenshot under public/, scaled to MAP_WIDTH. */
  src: string;
  /** Page height in CSS px at the phone width (PHONE.width). */
  height: number;
  /** In CSS px of the phone-wide page. A fixed widget (the floating player) is placed in the first screen. */
  boxes: { key: string; label: string; top: number; height: number; left: number; width: number; fixed: boolean }[];
}

/** The phone the measurements emulate: Lighthouse's mobile profile. */
export const PHONE = { width: 412, height: 823 } as const;

/** How long after the page has loaded the measured shopper scrolls to the first widget. */
export const REVEAL_AFTER_MS = 4000;

/** With the lazy loader, how long after the shopper scrolls to a widget its first thumbnail shows. */
export interface Reveal {
  widget: string;
  /** Median ms from scrolling the widget into view until its first thumbnail or player showed. */
  lazyMs: number;
  /** The same with standard loading. */
  standardMs: number;
}

export interface PerfReport {
  measuredAt: string;
  site: string;
  sdkRelease: string;
  lighthouseVersion: string;
  chrome: string;
  conditions: { device: string; network: string; cpu: string; cache: string; tracking: string; runs: number };
  pages: PerfPage[];
  setups: PerfSetup[];
  results: PerfResult[];
  pageMaps: Record<string, PageMap>;
  /** By setup id. */
  reveals: Record<string, Reveal[]>;
  /** The same pages without Firework on another site (the store before its own fixes), measured the same way. */
  baseline?: { site: string; measuredAt: string; results: PerfResult[] };
}
