// Helpers for /lab/performance and its details page: formatting, verdicts, and the numbers each visual draws.
// Pure functions, safe to import from client code.
import {
  groupOrder,
  perfPages,
  rate,
  ratingLabels,
  setupId,
  thresholds,
  type FwMode,
  type PerfGroup,
  type PerfPageId,
  type PerfReport,
  type PerfResult,
  type Rating,
} from './perf';

/** Chart colours: a validated categorical palette for the request groups. */
export const groupColors: Record<PerfGroup, string> = {
  site: '#2a78d6',
  'firework-sdk': '#eb6834',
  'firework-media': '#1baf7a',
  'firework-api': '#eda100',
  ava: '#e87ba4',
  livestream: '#008300',
  other: '#6250d6',
};

export const fmtKb = (bytes: number): string => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
export const fmtMs = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
export const fmtCls = (v: number): string => v.toFixed(3);
export const signed = (text: string, positive: boolean): string => (positive ? `+${text}` : `−${text}`);

export function resultOf(report: PerfReport, setup: string, mode: FwMode): PerfResult | undefined {
  return report.results.find((r) => r.setup === setup && r.mode === mode);
}

/** Groups that carry bytes anywhere in the report, in fixed order, so colours never shift between charts. */
export function activeGroups(report: PerfReport): PerfGroup[] {
  return groupOrder.filter((g) => report.results.some((r) => (r.network.groups[g]?.bytes ?? 0) > 0));
}

export function ratingOf(id: string, value: number): { rating: Rating; label: string } {
  const rating = rate(id, value);
  return { rating, label: ratingLabels[rating] };
}

export const thresholdFor = (id: string) => thresholds.find((t) => t.id === id)!;

/** Page weight before any video plays: all bytes minus the video that streamed in this run. */
export const weightOf = (r: PerfResult): number => r.network.bytes - (r.network.videoBytes ?? 0);

/** The most video that streamed in any run of this setup: what a playing video adds in the first seconds. */
export const videoMax = (r: PerfResult): number => r.ranges?.videoBytes?.[1] ?? r.network.videoBytes ?? 0;

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
      return `${u.host}${u.pathname.slice(0, 40)}`;
    }
    return `${u.host}${u.pathname.slice(0, 40)}`;
  } catch {
    return url.slice(0, 60);
  }
}

// ---------- perception: what a shopper notices ----------

/** The 2025 Web Almanac's median mobile home page: 2.56 MB. */
export const ALMANAC_MOBILE_HOME_BYTES = 2560 * 1024;

export type Level = 'ok' | 'edge' | 'warn' | 'bad';

/**
 * A pause after a tap. From the research Google cites for the INP threshold: up to about 100 ms reads as part of the
 * tap (Michotte), 100 to 200 ms is mixed, over 200 ms the response no longer feels caused by the tap, and at 300 ms
 * people rate a button press as poor (Kaaresoja et al.).
 */
export const tapBands = [
  { upTo: 100, level: 'ok' as Level, label: 'Feels instant' },
  { upTo: 200, level: 'edge' as Level, label: 'Barely noticeable' },
  { upTo: 300, level: 'warn' as Level, label: 'Noticeable' },
  { upTo: Infinity, level: 'bad' as Level, label: 'Clearly noticeable' },
];
export const tapVerdict = (ms: number) => tapBands.find((b) => ms <= b.upTo)!;

/**
 * Extra waiting for the main content. From Google's RAIL model: under 100 ms feels immediate, 100 to 1000 ms still
 * feels like one continuous step, beyond one second attention starts to drift.
 */
export const waitVerdict = (ms: number): { level: Level; label: string } =>
  ms <= 100 ? { level: 'ok', label: 'Not noticeable' } : ms <= 1000 ? { level: 'warn', label: 'Noticeable' } : { level: 'bad', label: 'Attention drifts' };

export const ratingLevel = (r: Rating): Level => (r === 'good' ? 'ok' : r === 'poor' ? 'bad' : 'warn');

// ---------- the configurator's view of one state ----------

export interface ViewState {
  page: PerfPageId;
  /** Widget keys, in the page's order. Empty means "script only". */
  widgets: string[];
  /** The loading mode the verdicts are about. */
  load: 'on' | 'lazy';
  numbers: boolean;
}

export interface Trio {
  off: PerfResult;
  on: PerfResult;
  lazy: PerfResult;
}

export function trio(report: PerfReport, page: PerfPageId, widgets: string[]): Trio | undefined {
  const off = resultOf(report, setupId(page, null), 'off');
  const id = setupId(page, widgets);
  const on = resultOf(report, id, 'on');
  const lazy = resultOf(report, id, 'lazy');
  return off && on && lazy ? { off, on, lazy } : undefined;
}

export interface SpeedVerdict {
  level: Level;
  /** "Same speed", "+0.4 s". */
  headline: string;
  /** Perception label for a later main image. */
  label: string;
  /** Middle-run difference, and the slowest run against the slowest run without Firework. */
  typical: number;
  worst: number;
  /** Google measured a different element with Firework (the widget pushed the main image down). */
  moved: boolean;
}

/** Does the page show up as fast? Compares the main content's paint time, honest about run-to-run noise. */
export function speedVerdict(off: PerfResult, sel: PerfResult): SpeedVerdict {
  const offMax = off.ranges?.lcp[1] ?? off.lighthouse.lcp;
  const selMax = sel.ranges?.lcp[1] ?? sel.lighthouse.lcp;
  const typical = sel.lighthouse.lcp - off.lighthouse.lcp;
  const worst = Math.max(0, selMax - offMax);
  const elOff = off.runtime.lcpElement?.selector;
  const elSel = sel.runtime.lcpElement?.selector;
  const moved = Boolean(elOff && elSel && elOff !== elSel && typical < -100);
  // When the runs with and without Firework overlap, the difference is run-to-run noise.
  const offMin = off.ranges?.lcp[0] ?? off.lighthouse.lcp;
  const selMin = sel.ranges?.lcp[0] ?? sel.lighthouse.lcp;
  const overlap = (off.runs > 1 || sel.runs > 1) && selMin <= offMax + 100 && offMin <= selMax + 100;
  if (moved || typical <= 100 || overlap) return { level: 'ok', headline: 'Same speed', label: 'Not noticeable', typical, worst, moved };
  const w = waitVerdict(typical);
  return { level: w.level, headline: `+${fmtMs(typical)}`, label: w.label, typical, worst, moved };
}

export interface StillVerdict {
  level: Level;
  headline: string;
}

export const stillVerdict = (cls: number): StillVerdict =>
  cls <= 0.1 ? { level: 'ok', headline: 'Nothing moves' } : cls <= 0.25 ? { level: 'warn', headline: 'Moves a little' } : { level: 'bad', headline: 'Jumps around' };

/** Bytes by part, for the weight bars: the page itself, Firework before any video, and video while it plays. */
export function weightParts(r: PerfResult): { page: number; firework: number; video: number } {
  const page = r.network.groups.site?.bytes ?? 0;
  return { page, firework: Math.max(0, weightOf(r) - page), video: videoMax(r) };
}

/** "about a fifth of a typical page" for an added weight. */
export function weightShare(bytes: number): string {
  const share = bytes / ALMANAC_MOBILE_HOME_BYTES;
  if (share < 0.05) return 'a sliver of a typical page';
  if (share < 0.15) return 'a tenth of a typical page';
  if (share < 0.3) return 'a fifth of a typical page';
  if (share < 0.45) return 'a third of a typical page';
  if (share < 0.75) return 'half a typical page';
  return 'about a whole typical page';
}

/** The page's label and its widgets' labels. */
export const pageOf = (id: PerfPageId) => perfPages.find((p) => p.id === id)!;
export const widgetLabel = (page: PerfPageId, key: string) => pageOf(page).widgets.find((w) => w.key === key)?.label ?? key;

/** "Product page with a Storyblock" → "product page with a Storyblock", keeping names such as Storyblock and AVA. */
export const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
