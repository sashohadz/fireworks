// The "how often is a phone visit this slow?" panel on /lab/performance: a map of Europe coloured by the share of
// phone visits on a connection like our Slow 4G test, from Chrome's real-user data (CrUX). Rendered on the server
// only, so the map's paths never reach the client bundle. Hover behaviour is in src/scripts/perf-configurator.ts.
import mapJson from '../data/perf/europe-map.json';
import rttJson from '../data/perf/crux-rtt.json';
import type { Connections, RttShares } from './perf';

interface EuropeMap {
  viewBox: [number, number];
  countries: { iso2: string; name: string; d: string }[];
  rest: string;
  labels: Record<string, [number, number]>;
}

export interface CruxRtt extends Connections {
  source: string;
  license: string;
  basis: 'top' | 'all';
  basisLabel: string;
  countries: Record<string, RttShares & { name: string; origins: number; p75: number | null }>;
}

export const map = mapJson as unknown as EuropeMap;
export const rtt = rttJson as unknown as CruxRtt;

/** What the client needs: the month and Europe's shares (the trigger's sentence). */
export const connections: Connections = { month: rtt.month, europe: rtt.europe, ...(rtt.sample ? { sample: true } : {}) };

/** A sequential blue ramp (dataviz palette steps 250–700), validated as an ordinal ramp on white. */
export const RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'] as const;
/** The three connection groups, light to dark, the darkest matching the map's "slow". Validated as an ordinal ramp. */
export const RTT_COLORS = { low: '#86b6ef', medium: '#3987e5', high: '#104281' } as const;

export const RTT_GROUPS = [
  { key: 'low', label: 'Faster than both tests', range: 'under 75 ms' },
  { key: 'medium', label: 'Like Fast 4G', range: '75–275 ms' },
  { key: 'high', label: 'Like Slow 4G, or slower', range: '275 ms or more' },
] as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** "5.5%" under 10% (where whole numbers would blur 2% and 3%), "47%" above. */
export const pctText = (v: number) => (v < 0.1 ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`);
export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Four round breaks (in shares) for five colour steps, the last one open-ended ("6%+"): the widest round step that
 * still puts the fourth break at or below the highest value, so every colour is used.
 */
export function breaks(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  for (const step of [0.1, 0.05, 0.025, 0.02, 0.01, 0.005, 0.0025]) {
    const start = Math.floor(min / step) * step;
    if (start + 4 * step <= max) return [1, 2, 3, 4].map((i) => Number((start + i * step).toFixed(4)));
  }
  return [0.2, 0.4, 0.6, 0.8];
}

const stepOf = (v: number, b: number[]) => b.filter((x) => v >= x).length;

/** Readout for one place: the sentence and the three-part bar, filled in by data-r hooks. */
function readout(name: string, s: RttShares): string {
  const bar = RTT_GROUPS.map((g) => `<span class="pv-rtt-${g.key}" data-r="bar-${g.key}" style="width:${(s[g.key] * 100).toFixed(1)}%"></span>`).join('');
  const key = RTT_GROUPS.map(
    (g) => `<li><i class="pv-rtt-${g.key}" aria-hidden="true"></i><span>${esc(g.label)} <b data-r="${g.key}">${pctText(s[g.key])}</b><small>${esc(g.range)}</small></span></li>`,
  ).join('');
  return `<div class="pv-rtt" aria-live="polite" data-europe="${esc(JSON.stringify({ name, ...s }))}">
    <p><b data-r="name">${esc(name)}</b>: <b data-r="slow">about ${Math.round(s.high * 100)} in 100</b> phone visits are this slow</p>
    <div class="pv-rtt-bar" aria-hidden="true">${bar}</div>
    <ul class="pv-rtt-key">${key}</ul>
  </div>`;
}

export function renderNetMap(): string {
  const [W, H] = map.viewBox;
  const values = Object.values(rtt.countries).map((c) => c.high);
  const b = breaks(values);
  const shapes = map.countries
    .map((c) => {
      const v = rtt.countries[c.iso2];
      if (!v) return `<path d="${c.d}" class="pv-euro-none"/>`;
      return `<path d="${c.d}" fill="${RAMP[stepOf(v.high, b)]}" data-iso="${esc(c.iso2)}" data-name="${esc(v.name)}" data-low="${v.low}" data-medium="${v.medium}" data-high="${v.high}"/>`;
    })
    .join('');
  const labels = Object.entries(map.labels)
    .filter(([iso2]) => rtt.countries[iso2])
    .map(([iso2, [x, y]]) => {
      const text = `${iso2} ${pctText(rtt.countries[iso2]!.high)}`;
      const w = 10 + text.length * 6.1;
      return `<g class="pv-euro-label" data-label="${esc(iso2)}"><rect x="${(x - w / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" width="${w.toFixed(1)}" height="16" rx="8"/><text x="${x}" y="${(y + 4).toFixed(1)}">${esc(text)}</text></g>`;
    })
    .join('');
  const legendSteps = RAMP.map((color, i) => {
    const n = (v: number) => `${Number((v * 100).toFixed(1))}`;
    const label = i === 0 ? `under ${n(b[0]!)}%` : i === RAMP.length - 1 ? `${n(b[i - 1]!)}% or more` : `${n(b[i - 1]!)}–${n(b[i]!)}%`;
    return `<li><i style="background:${color}" aria-hidden="true"></i>${esc(label)}</li>`;
  }).join('');
  const rows = Object.entries(rtt.countries)
    .sort((a, c) => a[1].name.localeCompare(c[1].name))
    .map(([, c]) => `<tr><th scope="row">${esc(c.name)}</th><td>${pctText(c.high)}</td><td>${pctText(c.medium)}</td><td>${pctText(c.low)}</td><td>${c.origins.toLocaleString('en-GB')}</td></tr>`)
    .join('');
  const month = monthLabel(rtt.month);
  const top = Object.entries(rtt.countries).sort((a, c) => a[1].high - c[1].high);
  const summary = `Map of Europe: share of phone visits as slow as Slow 4G. Lowest ${top[0]![1].name} ${pctText(top[0]![1].high)}, highest ${top.at(-1)![1].name} ${pctText(top.at(-1)![1].high)}.`;

  return `<div id="pv-netmap" class="pv-pop" role="dialog" aria-labelledby="pv-netmap-h">
    <button type="button" class="pv-pop-close" data-netmap-close aria-label="Close">×</button>
    <h3 id="pv-netmap-h">How often is a phone visit this slow?</h3>
    <p class="pv-pop-sub">Phone visits on a connection like our Slow 4G test, or slower. Chrome’s real visits, ${esc(month)}.</p>
    ${rtt.sample ? '<p class="pv-sample">Sample data: not real numbers yet</p>' : ''}
    <svg class="pv-euro" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">
      <path d="${map.rest}" class="pv-euro-rest"/>${shapes}${labels}
    </svg>
    <div class="pv-pop-side">
      <p class="pv-euro-legend-h">Phone visits this slow</p>
      <ul class="pv-euro-legend">${legendSteps}</ul>
      ${readout('Europe', rtt.europe)}
    </div>
    <div class="pv-euro-table"><table>
      <caption>Phone visits by connection, ${esc(month)}</caption>
      <thead><tr><th scope="col">Country</th><th scope="col">Like Slow 4G or slower</th><th scope="col">Like Fast 4G</th><th scope="col">Faster</th><th scope="col">Websites</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="pv-pop-foot">
      <a href="https://developer.chrome.com/docs/crux">Chrome UX Report</a>, phones, ${esc(month)}: ${esc(rtt.basisLabel)}; Europe weighted by population.
      “This slow” means a round trip of 275 ms or more, where Lighthouse’s Slow 4G sits, so it is approximate.
      <a href="/lab/performance/details/#connections">How it’s worked out</a>. Data CC BY 4.0; borders Natural Earth.
    </p>
  </div>`;
}

/** For the details page: every country's three shares. */
export const rttRows = () => Object.entries(rtt.countries).sort((a, c) => a[1].name.localeCompare(c[1].name));
