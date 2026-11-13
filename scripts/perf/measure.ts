// Measures what Firework adds to this site's pages in the setups listed in src/lib/perf.ts (?widgets= picks the
// widgets), with Lighthouse's mobile profile (Moto G Power, slow 4G, 4x CPU slowdown, cold cache), in three modes:
// fw=off (no Firework at all), fw=lazy (fwn-async.js) and fw=on (the full SDK). Writes src/data/perf/latest.json
// for /lab/performance.
//
// Usage: build and preview the site first, then
//   BASE_URL=http://127.0.0.1:4391 npm run perf:measure -- --runs 3
// Firework's tracking pixel is blocked, so the runs don't count as visits in the sandbox channel's Insights.
// The raw Lighthouse reports go to out/perf/. After a change to this script's summary, --from-raw rebuilds the
// JSON from them without running Lighthouse again.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import {
  groupOfHost,
  perfScenarios,
  scenarioUrl,
  type FwMode,
  type GroupTotals,
  type PerfGroup,
  type PerfReport,
  type PerfResult,
} from '../../src/lib/perf';

const base = (process.env.BASE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '');
const runs = Math.max(1, Number(process.argv[process.argv.indexOf('--runs') + 1]) || 1);
const only = process.argv.includes('--scenario') ? process.argv[process.argv.indexOf('--scenario') + 1] : null;
const fromRaw = process.argv.includes('--from-raw');
const modes: FwMode[] = ['off', 'lazy', 'on'];
const OUT = path.resolve('src/data/perf/latest.json');
const RAW = path.resolve('out/perf');

/** The parts of a Lighthouse result this script reads. */
interface Lhr {
  requestedUrl?: string;
  lighthouseVersion: string;
  environment: { hostUserAgent: string };
  categories: { performance: { score: number | null } };
  audits: Record<string, { numericValue?: number; details?: { items?: Record<string, unknown>[] } }>;
}

interface Run {
  lighthouse: PerfResult['lighthouse'];
  network: PerfResult['network'];
  runtime: PerfResult['runtime'];
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

function summarise(lhr: Lhr): Run {
  // The site is whatever host the report was measured on, so saved reports re-summarise on any port.
  const siteHosts = [...new Set([hostOf(lhr.requestedUrl ?? ''), new URL(base).host].filter(Boolean))];
  const groups: Partial<Record<PerfGroup, GroupTotals>> = {};
  const types: Record<string, number> = {};
  const add = (g: PerfGroup) => (groups[g] ??= { requests: 0, bytes: 0, scriptMs: 0 });
  const requests = items(lhr, 'network-requests').filter((r) => typeof r.url === 'string' && !String(r.url).startsWith('data:'));
  const fw: { url: string; bytes: number; type: string }[] = [];
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
  const longTasks = items(lhr, 'long-tasks');
  // The element Lighthouse took as the largest contentful paint, and whether Firework rendered it.
  const lcpNode = items(lhr, 'lcp-breakdown-insight').find((it) => it.type === 'node') as { selector?: string; path?: string } | undefined;
  const lcpElement = lcpNode
    ? { selector: String(lcpNode.selector ?? '?'), firework: /FW-[A-Z-]+/.test(String(lcpNode.path ?? '')) }
    : undefined;
  return {
    lighthouse: {
      score: Math.round((lhr.categories.performance.score ?? 0) * 100),
      lcp: num(lhr, 'largest-contentful-paint'),
      fcp: num(lhr, 'first-contentful-paint'),
      cls: num(lhr, 'cumulative-layout-shift'),
      tbt: num(lhr, 'total-blocking-time'),
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
      longTaskMs: longTasks.reduce((a, t) => a + Number(t.duration ?? 0), 0),
      longestTaskMs: Math.max(0, ...longTasks.map((t) => Number(t.duration ?? 0))),
      mainThreadMs: num(lhr, 'mainthread-work-breakdown'),
      // The module build loads chunks under /js/module/chunks/; the lazy loader fetches the legacy /js/fwn.js build.
      sdkLoaded: requests.some((r) => /asset\.fwcdn3\.com\/js\/(module\/chunks\/|chunks\/|fwn\.js$)/.test(String(r.url))),
      shifts,
      lcpElement,
    },
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
});

async function sdkRelease(): Promise<string> {
  try {
    const text = await (await fetch('https://asset.fwcdn3.com/js/module/fwn.js')).text();
    return /Release:\s*(\S+)/.exec(text)?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(RAW, { recursive: true });
  let chrome: Awaited<ReturnType<typeof launch>> | null = null;
  if (!fromRaw) {
    const health = await fetch(`${base}/`).catch(() => null);
    if (!health?.ok) throw new Error(`Nothing is serving ${base}. Build and preview the site first, then set BASE_URL.`);
    chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--disable-gpu'] });
  }
  const results: PerfResult[] = [];
  let lhVersion = '';
  let chromeUa = '';
  let measuredSite = '';
  try {
    for (const scenario of perfScenarios.filter((p) => !only || p.id === only)) {
      for (const mode of modes) {
        const url = `${base}${scenarioUrl(scenario, mode)}`;
        const all: Run[] = [];
        const saved = fs.readdirSync(RAW).filter((f) => f.startsWith(`${scenario.id}-${mode}-`) && f.endsWith('.json')).length;
        const count = fromRaw ? saved : runs;
        for (let i = 0; i < count; i++) {
          process.stdout.write(`${scenario.id} fw=${mode} run ${i + 1}/${count}${fromRaw ? ' (saved)' : ''} … `);
          const file = path.join(RAW, `${scenario.id}-${mode}-${i + 1}.json`);
          let lhr: Lhr;
          if (fromRaw) {
            lhr = JSON.parse(fs.readFileSync(file, 'utf8')) as Lhr;
          } else {
            const result = await lighthouse(url, {
              port: chrome!.port,
              output: 'json',
              logLevel: 'error',
              onlyCategories: ['performance'],
              // Tracking events only. Everything else loads as it would for a visitor.
              blockedUrlPatterns: ['*/trk/*'],
            });
            if (!result) throw new Error('Lighthouse returned nothing');
            lhr = result.lhr as unknown as Lhr;
            fs.writeFileSync(file, String(result.report));
          }
          lhVersion = lhr.lighthouseVersion;
          chromeUa = lhr.environment.hostUserAgent;
          if (lhr.requestedUrl) measuredSite = new URL(lhr.requestedUrl).origin;
          const run = summarise(lhr);
          all.push(run);
          console.log(`score ${run.lighthouse.score}, LCP ${Math.round(run.lighthouse.lcp)} ms, TBT ${Math.round(run.lighthouse.tbt)} ms, ${run.network.requests} requests, ${Math.round(run.network.bytes / 1024)} KB`);
        }
        if (!all.length) throw new Error(`No saved reports for ${scenario.id} fw=${mode} in ${path.relative(process.cwd(), RAW)}`);
        results.push({ scenario: scenario.id, mode, url: scenarioUrl(scenario, mode), ...median(all), runs: all.length, ranges: ranges(all) });
      }
    }
  } finally {
    await chrome?.kill();
  }
  const previous = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, 'utf8')) as PerfReport) : null;
  // With --scenario, only that setup was measured: keep the other setups' results from the previous file.
  if (only && previous) {
    const kept = previous.results.filter((r) => r.scenario !== only && perfScenarios.some((s) => s.id === r.scenario));
    results.unshift(...kept);
    results.sort((a, b) => perfScenarios.findIndex((s) => s.id === a.scenario) - perfScenarios.findIndex((s) => s.id === b.scenario));
  }
  const report: PerfReport = {
    // Re-summarised reports keep the date they were measured.
    measuredAt: fromRaw && previous ? previous.measuredAt : new Date().toISOString(),
    site: fromRaw ? measuredSite || base : base,
    sdkRelease: await sdkRelease(),
    lighthouseVersion: lhVersion,
    chrome: /Chrome\/([\d.]+)/.exec(chromeUa)?.[1] ?? chromeUa,
    conditions: {
      device: 'Lighthouse mobile profile (Moto G Power emulation)',
      network: 'Simulated slow 4G (1.6 Mbps down, 150 ms RTT)',
      cpu: '4x slowdown',
      cache: 'Cold: storage and cache cleared before each run',
      tracking: "Firework's tracking pixel blocked, so the runs are not counted as visits",
    },
    scenarios: perfScenarios,
    results,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT)} (${results.length} results, median of ${results[0]?.runs ?? 0}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
