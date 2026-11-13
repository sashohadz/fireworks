// Helpers for /lab/performance: formatting, deltas and the series the charts draw. Safe to import from client code.
import { groupOrder, rate, ratingLabels, thresholds, type FwMode, type PerfGroup, type PerfReport, type PerfResult, type Rating } from './perf';

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

export function result(report: PerfReport, page: string, mode: FwMode): PerfResult | undefined {
  return report.results.find((r) => r.page === page && r.mode === mode);
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
  page: string;
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

export function pageDelta(report: PerfReport, page: string): PageDelta | undefined {
  const on = result(report, page, 'on');
  const off = result(report, page, 'off');
  if (!on || !off) return undefined;
  return {
    page,
    bytes: on.network.bytes - off.network.bytes,
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
