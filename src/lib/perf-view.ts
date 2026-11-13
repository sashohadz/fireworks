// Helpers for /lab/performance: formatting, deltas and the series the charts draw. Safe to import from client code.
import {
  groupOrder,
  rate,
  ratingLabels,
  thresholds,
  type FwMode,
  type PerfGroup,
  type PerfReport,
  type PerfResult,
  type PerfScenario,
  type Rating,
} from './perf';

/** Chart colours: a validated categorical palette for the request groups and a one-hue ramp for the three modes. */
export const groupColors: Record<PerfGroup, string> = {
  site: '#2a78d6',
  'firework-sdk': '#eb6834',
  'firework-media': '#1baf7a',
  'firework-api': '#eda100',
  ava: '#e87ba4',
  livestream: '#008300',
  other: '#6250d6',
};

export const modeColors: Record<FwMode, string> = { off: '#86b6ef', lazy: '#2a78d6', on: '#104281' };

export const fmtKb = (bytes: number): string => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`);
export const fmtMs = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
export const fmtCls = (v: number): string => v.toFixed(3);
export const signed = (text: string, positive: boolean): string => (positive ? `+${text}` : `−${text}`);

export function result(report: PerfReport, scenario: string, mode: FwMode): PerfResult | undefined {
  return report.results.find((r) => r.scenario === scenario && r.mode === mode);
}

/** Groups that carry bytes anywhere in the report, in fixed order, so colours never shift between charts. */
export function activeGroups(report: PerfReport): PerfGroup[] {
  return groupOrder.filter((g) => report.results.some((r) => (r.network.groups[g]?.bytes ?? 0) > 0));
}

export interface MetricSpec {
  id: 'lcp' | 'tbt' | 'cls' | 'fcp' | 'si';
  label: string;
  value: (r: PerfResult) => number;
  format: (v: number) => string;
}

export const metricSpecs: MetricSpec[] = [
  { id: 'lcp', label: 'Largest Contentful Paint', value: (r) => r.lighthouse.lcp, format: fmtMs },
  { id: 'tbt', label: 'Total Blocking Time', value: (r) => r.lighthouse.tbt, format: fmtMs },
  { id: 'cls', label: 'Cumulative Layout Shift', value: (r) => r.lighthouse.cls, format: fmtCls },
  { id: 'si', label: 'Speed Index', value: (r) => r.lighthouse.si, format: fmtMs },
];

export function ratingOf(id: string, value: number): { rating: Rating; label: string } {
  const rating = rate(id, value);
  return { rating, label: ratingLabels[rating] };
}

export const thresholdFor = (id: string) => thresholds.find((t) => t.id === id)!;

/** What Firework adds to a page: the "on" run against the "off" run. */
export interface PageDelta {
  scenario: string;
  bytes: number;
  requests: number;
  tbt: number;
  lcp: number;
  cls: number;
  scoreOff: number;
  scoreOn: number;
  on: PerfResult;
  off: PerfResult;
}

/** Page weight before any video plays: all bytes minus the video that streamed in this run. */
export const weightOf = (r: PerfResult): number => r.network.bytes - (r.network.videoBytes ?? 0);

/** The most video that streamed in any run of this setup: what a playing video adds in the first seconds. */
export const videoMax = (r: PerfResult): number => r.ranges?.videoBytes?.[1] ?? r.network.videoBytes ?? 0;

export function pageDelta(report: PerfReport, scenario: string): PageDelta | undefined {
  const on = result(report, scenario, 'on');
  const off = result(report, scenario, 'off');
  if (!on || !off) return undefined;
  return {
    scenario,
    bytes: weightOf(on) - weightOf(off),
    requests: on.network.requests - off.network.requests,
    tbt: on.lighthouse.tbt - off.lighthouse.tbt,
    lcp: on.lighthouse.lcp - off.lighthouse.lcp,
    cls: on.lighthouse.cls - off.lighthouse.cls,
    scoreOff: off.lighthouse.score,
    scoreOn: on.lighthouse.score,
    on,
    off,
  };
}

/** A short name for a Firework request, for the "what is in it" table. */
export function describeRequest(url: string): string {
  try {
    const u = new URL(url);
    const file = u.pathname.split('/').filter(Boolean).pop() ?? '';
    if (u.host === 'asset.fwcdn3.com') return /chunks\//.test(u.pathname) ? `SDK chunk ${file}` : `SDK ${file}`;
    if (u.host === 'asset.fwscripts.com') return `AVA ${file}`;
    if (/fireworktv\.com$/.test(u.host)) {
      if (/\/medias\//.test(u.pathname)) return 'Video preview or poster';
      if (/\.(jpe?g|png|webp|gif)$/i.test(file)) return 'Image';
      if (/\.(mp4|m3u8|ts|webm)$/i.test(file)) return 'Video';
      return `${u.host}${u.pathname.slice(0, 40)}`;
    }
    return `${u.host}${u.pathname.slice(0, 40)}`;
  } catch {
    return url.slice(0, 60);
  }
}

// ---------- plain-language helpers for the overview ----------

/** The 2025 Web Almanac's median mobile home page: 2.56 MB. */
export const ALMANAC_MOBILE_HOME_BYTES = 2560 * 1024;

/** A page weight in context: how it compares with a typical home page. */
export function weightContext(bytes: number): string {
  const share = bytes / ALMANAC_MOBILE_HOME_BYTES;
  if (share < 0.08) return 'a small fraction of a typical home page';
  if (share < 0.35) return `about ${Math.round(share * 100)}% of a typical home page`;
  if (share < 0.8) return `about ${share < 0.6 ? 'half' : 'two thirds'} of a typical home page`;
  if (share < 1.2) return 'about as much as a typical home page';
  return `${share.toFixed(1)} times a typical home page`;
}

export type Perceived = 'instant' | 'borderline' | 'noticeable' | 'clear';

export interface Perception {
  level: Perceived;
  text: string;
}

/**
 * What a pause after a tap feels like. From the research Google cites for the INP threshold: delays up to about
 * 100 ms read as part of the action (Michotte), 100 to 200 ms are mixed, over 200 ms the response no longer feels
 * caused by the tap, and at 300 ms people rate a button press as poor (Kaaresoja et al.).
 */
export function tapPause(ms: number): Perception {
  if (ms <= 100) return { level: 'instant', text: 'feels instant (up to about 100 ms, a response reads as part of the tap)' };
  if (ms <= 200) return { level: 'borderline', text: 'is at the edge of what people notice (between 100 and 200 ms, the link between tap and response starts to break)' };
  if (ms <= 300) return { level: 'noticeable', text: 'is noticeable (over 200 ms, the response no longer feels caused by the tap)' };
  return { level: 'clear', text: 'is clearly noticeable (at 300 ms, people rate a button press as poor)' };
}

/**
 * What extra waiting for the main content feels like. From Google's RAIL model: under 100 ms feels immediate,
 * 100 to 1000 ms feels like part of a continuous task, and beyond one second people lose focus.
 */
export function extraWait(ms: number): Perception {
  if (ms <= 100) return { level: 'instant', text: 'not noticeable (under 100 ms reads as immediate)' };
  if (ms <= 1000) return { level: 'noticeable', text: 'noticeable, though loading still feels like one continuous step (research puts that limit at about one second)' };
  return { level: 'clear', text: 'a wait people notice (beyond one second, attention starts to drift)' };
}

export const perceivedLabels: Record<Perceived, string> = {
  instant: 'Not noticeable',
  borderline: 'Barely noticeable',
  noticeable: 'Noticeable',
  clear: 'Clearly noticeable',
};

export const scenarioById = (report: PerfReport, id: string): PerfScenario | undefined => report.scenarios.find((s) => s.id === id);

/** What an add-on costs on top of the setup it adds to: Firework on with it, minus Firework on without it. */
/** Whether two results' LCP runs overlap: then the difference between them is run-to-run noise, not a real change. */
const lcpOverlaps = (a: PerfResult, b: PerfResult): boolean => {
  const ra = a.ranges?.lcp ?? [a.lighthouse.lcp, a.lighthouse.lcp];
  const rb = b.ranges?.lcp ?? [b.lighthouse.lcp, b.lighthouse.lcp];
  return ra[0] <= rb[1] + 100 && rb[0] <= ra[1] + 100;
};

export interface AddonDelta {
  /** Weight before any video plays. */
  bytes: number;
  /** Extra video that can stream while it plays. */
  video: number;
  requests: number;
  tbt: number;
  longest: number;
  lcp: number;
  /** The LCP runs with and without it overlap, so the LCP difference is within the run-to-run spread. */
  lcpWithinNoise: boolean;
  cls: number;
  base: string;
}

/** What an add-on costs on top of the setup it adds to: Firework on with it, minus Firework on without it. */
export function addonDelta(report: PerfReport, addon: PerfScenario): AddonDelta | undefined {
  const withIt = result(report, addon.id, 'on');
  const without = addon.addsTo ? result(report, addon.addsTo, 'on') : result(report, addon.id, 'off');
  if (!withIt || !without) return undefined;
  return {
    bytes: weightOf(withIt) - weightOf(without),
    video: Math.max(0, videoMax(withIt) - videoMax(without)),
    requests: withIt.network.requests - without.network.requests,
    tbt: withIt.lighthouse.tbt - without.lighthouse.tbt,
    longest: withIt.runtime.longestTaskMs - without.runtime.longestTaskMs,
    lcp: withIt.lighthouse.lcp - without.lighthouse.lcp,
    lcpWithinNoise: lcpOverlaps(withIt, without),
    cls: withIt.lighthouse.cls - without.lighthouse.cls,
    base: addon.addsTo ? (scenarioById(report, addon.addsTo)?.label ?? addon.addsTo) : 'the page without Firework',
  };
}

/** Plain-language answer to "does the page show up as fast?" for one setup. */
export interface LcpStory {
  /** same: no noticeable difference. later: the main content showed up later. moved: Google measured a different element. */
  kind: 'same' | 'later' | 'moved';
  /** Middle run with Firework minus middle run without. */
  typical: number;
  /** Slowest run with Firework minus slowest run without: fair against run-to-run noise. */
  worst: number;
  perception: Perception;
  text: string;
  /** With the lazy loader, the main content showed up as fast as without Firework. */
  lazyHelps: boolean;
}

export function lcpStory(off: PerfResult, on: PerfResult, lazy?: PerfResult): LcpStory {
  const offMax = off.ranges?.lcp[1] ?? off.lighthouse.lcp;
  const onMax = on.ranges?.lcp[1] ?? on.lighthouse.lcp;
  const typical = on.lighthouse.lcp - off.lighthouse.lcp;
  const worst = Math.max(0, onMax - offMax);
  const runs = on.runs;
  const lazyMax = lazy ? (lazy.ranges?.lcp[1] ?? lazy.lighthouse.lcp) : Infinity;
  const lazyHelps = worst > 100 && lazyMax <= offMax + 100;
  const elOff = off.runtime.lcpElement?.selector;
  const elOn = on.runtime.lcpElement?.selector;
  if (elOff && elOn && elOff !== elOn && on.lighthouse.lcp < off.lighthouse.lcp - 100) {
    return {
      kind: 'moved',
      typical,
      worst: 0,
      perception: extraWait(0),
      lazyHelps: false,
      text: "At least as fast. The videos move the page's main image below the first screen, so Google measures a different element, which paints sooner.",
    };
  }
  const perception = extraWait(worst);
  if (worst <= 100) return { kind: 'same', typical, worst, perception, lazyHelps, text: 'No difference a shopper would notice.' };
  const lead = typical > 100 ? `Typically ${fmtMs(typical)} later, ${fmtMs(worst)} in the slowest of ${runs} runs` : `Usually no later; ${fmtMs(worst)} later in the slowest of ${runs} runs`;
  return {
    kind: 'later',
    typical,
    worst,
    perception,
    lazyHelps,
    text: `${lead}: ${perception.text}. Firework's script and the main image share the slow connection.${lazyHelps ? ' With the lazy loader it showed up as fast as without Firework.' : ''}`,
  };
}

/** "Home page with a carousel" → "home page with a carousel", keeping names such as Storyblock and AVA. */
export const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
