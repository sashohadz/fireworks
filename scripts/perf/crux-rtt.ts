// Turns the result of scripts/perf/crux-rtt.sql (run in the BigQuery console) into src/data/perf/crux-rtt.json,
// the data behind the "how often is a phone visit this slow?" map on /lab/performance.
//
//   npm run perf:rtt -- private/crux-rtt.json            (BigQuery "JSON (local file)", newline JSON or CSV also work)
//   npm run perf:rtt -- private/crux-rtt.json --basis all (use all websites instead of the most visited ones)
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('src/data/perf/crux-rtt.json');

/** Covered countries, with population in millions (2025: Eurostat, and ONS, SSB and FSO for GB, NO and CH), rounded. */
export const COUNTRIES: Record<string, { name: string; pop: number }> = {
  AT: { name: 'Austria', pop: 9.2 },
  BE: { name: 'Belgium', pop: 11.8 },
  BG: { name: 'Bulgaria', pop: 6.4 },
  HR: { name: 'Croatia', pop: 3.9 },
  CY: { name: 'Cyprus', pop: 1.0 },
  CZ: { name: 'Czechia', pop: 10.9 },
  DK: { name: 'Denmark', pop: 6.0 },
  EE: { name: 'Estonia', pop: 1.4 },
  FI: { name: 'Finland', pop: 5.6 },
  FR: { name: 'France', pop: 68.6 },
  DE: { name: 'Germany', pop: 83.6 },
  GR: { name: 'Greece', pop: 10.4 },
  HU: { name: 'Hungary', pop: 9.5 },
  IE: { name: 'Ireland', pop: 5.4 },
  IT: { name: 'Italy', pop: 58.9 },
  LV: { name: 'Latvia', pop: 1.9 },
  LT: { name: 'Lithuania', pop: 2.9 },
  LU: { name: 'Luxembourg', pop: 0.7 },
  MT: { name: 'Malta', pop: 0.6 },
  NL: { name: 'Netherlands', pop: 18.0 },
  PL: { name: 'Poland', pop: 36.5 },
  PT: { name: 'Portugal', pop: 10.7 },
  RO: { name: 'Romania', pop: 19.0 },
  SK: { name: 'Slovakia', pop: 5.4 },
  SI: { name: 'Slovenia', pop: 2.1 },
  ES: { name: 'Spain', pop: 49.1 },
  SE: { name: 'Sweden', pop: 10.6 },
  GB: { name: 'United Kingdom', pop: 69.3 },
  NO: { name: 'Norway', pop: 5.6 },
  CH: { name: 'Switzerland', pop: 9.1 },
};

/** Below this many most-visited websites in a country, its figure would rest on too few sites: use all websites. */
const MIN_TOP_ORIGINS = 200;

type Row = Record<string, string | number | null>;

function readRows(file: string): Row[] {
  const text = fs.readFileSync(file, 'utf8').trim();
  if (text.startsWith('[')) return JSON.parse(text) as Row[];
  if (text.startsWith('{')) return text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row);
  const [head, ...lines] = text.split(/\r?\n/);
  const cols = head!.split(',').map((c) => c.trim());
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.trim()])));
}

const num = (v: unknown): number => (v === null || v === undefined || v === '' ? NaN : Number(v));
const round = (v: number) => Math.round(v * 10000) / 10000;

const file = process.argv[2];
if (!file || file.startsWith('--')) {
  console.error('Usage: npm run perf:rtt -- <BigQuery result file> [--basis top|all]');
  process.exit(1);
}
const basisArg = process.argv.includes('--basis') ? process.argv[process.argv.indexOf('--basis') + 1] : 'auto';

const rows = readRows(path.resolve(file));
const months = new Set(rows.map((r) => String(r.yyyymm)));
if (months.size !== 1) throw new Error(`Expected one month, got ${[...months].join(', ') || 'none'}`);
const yyyymm = [...months][0]!;

const parsed = rows.map((r) => {
  const iso2 = String(r.country ?? '').toUpperCase();
  if (!COUNTRIES[iso2]) throw new Error(`Unexpected country "${iso2}"`);
  return {
    iso2,
    origins: num(r.origins),
    topOrigins: num(r.top_origins),
    all: { low: num(r.low), medium: num(r.medium), high: num(r.high) },
    top: { low: num(r.top_low), medium: num(r.top_medium), high: num(r.top_high) },
    p75: num(r.median_p75_rtt),
  };
});
const missing = Object.keys(COUNTRIES).filter((c) => !parsed.some((p) => p.iso2 === c));
if (missing.length) console.warn(`No data for ${missing.join(', ')}: drawn grey.`);

const topUsable = parsed.every((p) => p.topOrigins >= MIN_TOP_ORIGINS && Number.isFinite(p.top.high));
const basis = basisArg === 'all' || basisArg === 'top' ? basisArg : topUsable ? 'top' : 'all';
if (basis === 'top' && !topUsable) console.warn(`Some countries have fewer than ${MIN_TOP_ORIGINS} most-visited websites.`);

const countries: Record<string, { name: string; low: number; medium: number; high: number; origins: number; p75: number | null }> = {};
for (const p of parsed) {
  const f = basis === 'top' ? p.top : p.all;
  const sum = f.low + f.medium + f.high;
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > 0.02) throw new Error(`${p.iso2}: fractions sum to ${sum}, expected 1`);
  countries[p.iso2] = {
    name: COUNTRIES[p.iso2]!.name,
    low: round(f.low / sum),
    medium: round(f.medium / sum),
    high: round(f.high / sum),
    origins: basis === 'top' ? p.topOrigins : p.origins,
    p75: Number.isFinite(p.p75) ? p.p75 : null,
  };
}

// Europe as a whole: each country weighted by its population.
const weight = Object.keys(countries).reduce((s, c) => s + COUNTRIES[c]!.pop, 0);
const europe = (['low', 'medium', 'high'] as const).reduce(
  (acc, k) => ({ ...acc, [k]: round(Object.entries(countries).reduce((s, [c, v]) => s + v[k] * COUNTRIES[c]!.pop, 0) / weight) }),
  {} as Record<'low' | 'medium' | 'high', number>,
);

const json = {
  // Made-up numbers for building the page before the real query has run; the page marks them as a sample.
  ...(process.argv.includes('--sample') ? { sample: true } : {}),
  month: `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}`,
  source: 'Chrome UX Report (CrUX), materialized.country_summary, phone',
  license: 'CC BY 4.0',
  basis,
  basisLabel: basis === 'top' ? 'average over the 10,000 most visited websites in each country' : 'average over all websites in each country',
  bins: { low: '< 75 ms', medium: '75–275 ms', high: '≥ 275 ms' },
  europe,
  countries,
};
fs.writeFileSync(OUT, `${JSON.stringify(json, null, 2)}\n`);
const sorted = Object.entries(countries).sort((a, b) => a[1].high - b[1].high);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${json.month}, ${Object.keys(countries).length} countries, basis ${basis}.`);
console.log(`Europe: ${(europe.high * 100).toFixed(1)}% slow. Lowest ${sorted[0]![0]} ${(sorted[0]![1].high * 100).toFixed(1)}%, highest ${sorted.at(-1)![0]} ${(sorted.at(-1)![1].high * 100).toFixed(1)}%.`);
