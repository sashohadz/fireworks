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

/**
 * A setup to measure: a page of this store with a chosen set of widgets (?widgets=). "core" setups are what most
 * customers start with and lead the overview; "addon" setups show what one more feature costs; "stress" is the demo
 * store's showcase home page with everything on.
 */
export interface PerfScenario {
  id: string;
  label: string;
  /** Page path, with a trailing slash. */
  path: string;
  /** Keys for ?widgets= (see WIDGET_KEYS in settings.ts). */
  widgets: string[];
  /** What the shopper sees when Firework is on. */
  shows: string[];
  tier: 'core' | 'addon' | 'stress';
  /** For an add-on: the core scenario it adds to. */
  addsTo?: string;
}

export const perfScenarios: PerfScenario[] = [
  { id: 'home-carousel', label: 'Home page with a carousel', path: '/', widgets: ['carousel'], shows: ['Carousel'], tier: 'core' },
  { id: 'product-storyblock', label: 'Product page with a Storyblock', path: '/products/cloudberry-vitamin-c-serum/', widgets: ['pdp'], shows: ['Storyblock of videos tagged with the product'], tier: 'core' },
  { id: 'shop-grid', label: 'Category page with a video grid', path: '/shop/', widgets: ['grid', 'stories'], shows: ['Grid', 'Circle stories'], tier: 'core' },
  { id: 'home-carousel-floating', label: 'Home page: carousel plus a floating player', path: '/', widgets: ['carousel', 'floating'], shows: ['Carousel', 'Floating player'], tier: 'addon', addsTo: 'home-carousel' },
  { id: 'product-storyblock-ava', label: 'Product page: Storyblock plus AVA', path: '/products/cloudberry-vitamin-c-serum/', widgets: ['pdp', 'ava'], shows: ['Storyblock', 'AVA Product FAQ'], tier: 'addon', addsTo: 'product-storyblock' },
  { id: 'live-hero', label: 'Livestream page with a hero unit', path: '/live/', widgets: ['hero'], shows: ['Hero unit: countdown, live show or replay'], tier: 'addon' },
  { id: 'home-all', label: 'Home page with everything on', path: '/', widgets: ['hero', 'storyblock', 'carousel', 'floating'], shows: ['Hero unit (livestream)', 'Storyblock', 'Carousel', 'Floating player'], tier: 'stress' },
];

/** The URL a scenario is measured at. */
export const scenarioUrl = (s: PerfScenario, mode: FwMode): string => `${s.path}?widgets=${s.widgets.join(',')}&fw=${mode}`;

export const modeLabels: Record<FwMode, string> = {
  off: 'Without Firework',
  lazy: 'Lazy loader (fwn-async.js)',
  on: 'Firework on',
};

export interface GroupTotals {
  requests: number;
  /** Transferred bytes (compressed). */
  bytes: number;
  /** Script execution and parse time from Lighthouse's bootup-time audit (not layout or paint). */
  scriptMs: number;
}

export interface PerfResult {
  scenario: string;
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
  /** Number of runs this result is the median of. */
  runs: number;
  /** Lowest and highest value across the runs, to tell a real change from run-to-run noise. */
  ranges?: { lcp: [number, number]; tbt: [number, number]; bytes: [number, number]; videoBytes?: [number, number] };
}

export interface PerfReport {
  measuredAt: string;
  site: string;
  sdkRelease: string;
  lighthouseVersion: string;
  chrome: string;
  conditions: { device: string; network: string; cpu: string; cache: string; tracking: string };
  scenarios: PerfScenario[];
  results: PerfResult[];
}
