// "Measure in this browser" for /lab/performance: loads the chosen pages in each mode, one after the other, in this
// tab, and collects what the browser's own APIs report. Runs on every page (from boot.ts) and does nothing unless
// the URL has ?perf=<run id>. Results stay in sessionStorage, so nothing leaves the browser.
import { groupOfHost, type FwMode, type PerfGroup } from '../lib/perf';

export const PERF_KEY = 'fjb.perf.v1';
/** How long after load the page is watched, so lazy chunks and the widgets' own requests are counted. */
const SETTLE_MS = 8000;

export interface LiveStep {
  setup: string;
  mode: FwMode;
  /** Path and query of the page to load, without the perf parameter. */
  url: string;
}

export interface LiveResult {
  setup: string;
  mode: FwMode;
  url: string;
  at: string;
  fcp: number;
  lcp: number;
  cls: number;
  longTasks: number;
  longTaskMs: number;
  /** The part of each long task beyond 50 ms, like Lighthouse's TBT, but after load too. */
  blockingMs: number;
  requests: number;
  /** Requests whose size the browser may read (same origin, or Timing-Allow-Origin). */
  sized: number;
  bytes: number;
  groups: Partial<Record<PerfGroup, { requests: number; sized: number; bytes: number }>>;
  domNodes: number;
  sdkLoaded: boolean;
}

export interface LiveRun {
  id: string;
  startedAt: string;
  steps: LiveStep[];
  results: LiveResult[];
  returnTo: string;
  userAgent: string;
}

function load(): LiveRun | null {
  try {
    return JSON.parse(sessionStorage.getItem(PERF_KEY) ?? 'null') as LiveRun | null;
  } catch {
    return null;
  }
}

function save(run: LiveRun | null): void {
  try {
    if (run) sessionStorage.setItem(PERF_KEY, JSON.stringify(run));
    else sessionStorage.removeItem(PERF_KEY);
  } catch {
    /* storage blocked: the run stops here */
  }
}

export const readRun = (): LiveRun | null => load();
export const clearRun = (): void => save(null);

const stepUrl = (run: LiveRun, step: LiveStep) => `${step.url}${step.url.includes('?') ? '&' : '?'}perf=${run.id}`;

/** Starts a run from the lab page: saves the plan and goes to the first page. */
export function startRun(steps: LiveStep[], returnTo: string): void {
  const run: LiveRun = { id: Date.now().toString(36), startedAt: new Date().toISOString(), steps, results: [], returnTo, userAgent: navigator.userAgent };
  save(run);
  location.assign(stepUrl(run, steps[0]!));
}

function collect(step: LiveStep): LiveResult {
  const siteHosts = [location.host];
  const groups: LiveResult['groups'] = {};
  let requests = 0;
  let sized = 0;
  let bytes = 0;
  const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')] as PerformanceResourceTiming[];
  for (const e of entries) {
    if (e.name.startsWith('data:')) continue;
    let host = '';
    try {
      host = new URL(e.name).host;
    } catch {
      continue;
    }
    const g = groupOfHost(host, siteHosts);
    const t = (groups[g] ??= { requests: 0, sized: 0, bytes: 0 });
    requests++;
    t.requests++;
    if (e.transferSize > 0 || e.encodedBodySize > 0) {
      sized++;
      t.sized++;
      bytes += e.transferSize;
      t.bytes += e.transferSize;
    }
  }
  const m = window.__fjbPerf ?? { lcp: 0, cls: 0, longTasks: 0, longTaskMs: 0, blockingMs: 0 };
  return {
    setup: step.setup,
    mode: step.mode,
    url: location.pathname + location.search,
    at: new Date().toISOString(),
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
    lcp: m.lcp,
    cls: m.cls,
    longTasks: m.longTasks,
    longTaskMs: m.longTaskMs,
    blockingMs: m.blockingMs,
    requests,
    sized,
    bytes,
    groups,
    domNodes: document.getElementsByTagName('*').length,
    sdkLoaded: Boolean(customElements.get('fw-embed-feed') || customElements.get('fw-storyblock')),
  };
}

function observe(): void {
  const m = { lcp: 0, cls: 0, longTasks: 0, longTaskMs: 0, blockingMs: 0 };
  window.__fjbPerf = m;
  const watch = (type: string, fn: (entries: PerformanceEntry[]) => void) => {
    try {
      new PerformanceObserver((list) => fn(list.getEntries())).observe({ type, buffered: true });
    } catch {
      /* not supported in this browser */
    }
  };
  watch('largest-contentful-paint', (entries) => {
    for (const e of entries) m.lcp = e.startTime;
  });
  watch('layout-shift', (entries) => {
    for (const e of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) m.cls += e.value;
  });
  watch('longtask', (entries) => {
    for (const e of entries) {
      m.longTasks++;
      m.longTaskMs += e.duration;
      m.blockingMs += Math.max(0, e.duration - 50);
    }
  });
}

/** On a measured page: watch, wait, record, move on. Returns true when this page is part of a run. */
export function continueRun(): boolean {
  const id = new URLSearchParams(location.search).get('perf');
  if (!id) return false;
  const run = load();
  if (!run || run.id !== id) return false;
  const step = run.steps[run.results.length];
  if (!step) {
    location.replace(run.returnTo);
    return true;
  }
  observe();
  const finish = () => {
    const latest = load();
    if (!latest || latest.id !== id) return;
    latest.results.push(collect(step));
    save(latest);
    const next = latest.steps[latest.results.length];
    location.replace(next ? stepUrl(latest, next) : latest.returnTo);
  };
  const afterLoad = () => window.setTimeout(finish, SETTLE_MS);
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
  return true;
}

declare global {
  interface Window {
    __fjbPerf?: { lcp: number; cls: number; longTasks: number; longTaskMs: number; blockingMs: number };
  }
}
