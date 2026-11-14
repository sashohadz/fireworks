// Builds the Europe map behind the "how often is a phone visit this slow?" panel on /lab/performance.
// Natural Earth borders (public domain, via world-atlas), an equal-area projection centred on Europe, simplified to
// whole-ish pixels so the SVG stays small. Run once: npm run gen:europe-map → src/data/perf/europe-map.json.
import fs from 'node:fs';
import path from 'node:path';
import { geoAzimuthalEqualArea, geoCentroid, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiPoint } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

const WIDTH = 400;
const MIN_STEP = 1.4; // px: drop points closer than this to the previous one (covered countries)
const REST_STEP = 2.5; // px: the grey countries around them need less detail
const OUT = path.resolve('src/data/perf/europe-map.json');

/** The countries the panel covers: the EU, the UK, Norway and Switzerland. ISO numeric → alpha-2. */
export const COVERED: Record<string, string> = {
  '040': 'AT', '056': 'BE', '100': 'BG', '191': 'HR', '196': 'CY', '203': 'CZ', '208': 'DK', '233': 'EE',
  '246': 'FI', '250': 'FR', '276': 'DE', '300': 'GR', '348': 'HU', '372': 'IE', '380': 'IT', '428': 'LV',
  '440': 'LT', '442': 'LU', '470': 'MT', '528': 'NL', '616': 'PL', '620': 'PT', '642': 'RO', '703': 'SK',
  '705': 'SI', '724': 'ES', '752': 'SE', '826': 'GB', '578': 'NO', '756': 'CH',
};

/** Where the % label of the 10 most populous covered countries sits (lon, lat), nudged off crowded borders. */
const LABELS: Record<string, [number, number]> = {
  DE: [10.3, 51.4],
  GB: [-3.2, 52.5],
  FR: [2.3, 46.9],
  IT: [12.9, 42.6],
  ES: [-3.6, 40.0],
  PL: [19.2, 52.2],
  RO: [24.9, 45.9],
  NL: [5.6, 54.1],
  BE: [3.6, 50.1],
  CZ: [15.3, 49.7],
};

// The area to fit: Ireland and Portugal in the west, the North Cape and Finland in the north-east, Cyprus in the
// south-east. Iceland, Svalbard and the overseas parts of France, Spain and Portugal fall outside and are clipped.
const FRAME: MultiPoint = {
  type: 'MultiPoint',
  coordinates: [
    [-10.6, 51.8],
    [-9.6, 36.8],
    [-6.5, 35.6],
    [34.8, 34.4],
    [34.6, 36.2],
    [31.6, 70.4],
    [25.8, 71.3],
    [-8.0, 58.6],
  ],
};

/** A d3 path context that rounds to one decimal and skips points closer than MIN_STEP to the last one kept. */
function compactContext(step: number) {
  let out = '';
  let ring: [number, number][] = [];
  const flush = () => {
    // Whole pixels, then relative steps ("l1,-2 3,0"), which are short. Steps come from the rounded points: no drift.
    const pts = ring.map(([x, y]) => [Math.round(x), Math.round(y)] as const).filter((p, i, a) => i === 0 || p[0] !== a[i - 1]![0] || p[1] !== a[i - 1]![1]);
    if (pts.length >= 3) out += `M${pts[0]![0]},${pts[0]![1]}l${pts.slice(1).map((p, i) => `${p[0] - pts[i]![0]},${p[1] - pts[i]![1]}`).join(' ')}z`;
    ring = [];
  };
  return {
    beginPath() {},
    moveTo(x: number, y: number) {
      flush();
      ring.push([x, y]);
    },
    lineTo(x: number, y: number) {
      const last = ring[ring.length - 1]!;
      if (Math.hypot(x - last[0], y - last[1]) >= step) ring.push([x, y]);
    },
    closePath() {
      flush();
    },
    arc() {},
    result() {
      flush();
      const r = out;
      out = '';
      return r;
    },
  };
}

const topo = JSON.parse(fs.readFileSync(path.resolve('node_modules/world-atlas/countries-50m.json'), 'utf8')) as Topology<{
  countries: GeometryCollection<{ name: string }>;
}>;
const all = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;

const projection = geoAzimuthalEqualArea().rotate([-10, -52]).fitWidth(WIDTH, FRAME);
const [[, y0], [, y1]] = geoPath(projection).bounds(FRAME);
const HEIGHT = Math.ceil(y1 - y0 + 8);
projection.translate([projection.translate()[0], projection.translate()[1] - y0 + 4]).clipExtent([
  [0, 0],
  [WIDTH, HEIGHT],
]);

const draw = (f: Feature, step: number) => {
  const ctx = compactContext(step);
  geoPath(projection, ctx)(f);
  return ctx.result();
};

const countries: { iso2: string; name: string; d: string }[] = [];
let rest = '';
for (const f of all.features) {
  const id = String(f.id ?? '');
  // Northern Cyprus is drawn as part of Cyprus.
  const iso2 = COVERED[id] ?? (f.properties.name === 'N. Cyprus' ? 'CY' : undefined);
  let d = draw(f, iso2 ? MIN_STEP : REST_STEP);
  // Too small to keep a shape at this scale (Malta): a dot, so it can still be hovered.
  if (!d && iso2 && iso2 !== 'CY') {
    const [x, y] = projection(geoCentroid(f))!;
    d = `M${(x - 3).toFixed(1)},${y.toFixed(1)}a3,3 0 1,0 6,0a3,3 0 1,0 -6,0Z`;
  }
  if (!d) continue;
  if (!iso2) {
    rest += d;
    continue;
  }
  const existing = countries.find((c) => c.iso2 === iso2);
  if (existing) existing.d += d;
  else countries.push({ iso2, name: iso2 === 'CY' ? 'Cyprus' : f.properties.name, d });
}

const missing = Object.values(COVERED).filter((c) => !countries.some((x) => x.iso2 === c));
if (missing.length) throw new Error(`No shape for ${missing.join(', ')}`);

const labels = Object.fromEntries(
  Object.entries(LABELS).map(([iso2, lonLat]) => {
    const [x, y] = projection(lonLat)!;
    return [iso2, [Number(x.toFixed(1)), Number(y.toFixed(1))]];
  }),
);

countries.sort((a, b) => a.name.localeCompare(b.name));
const json = { source: 'Natural Earth 1:50m via world-atlas 2.0.2 (public domain)', viewBox: [WIDTH, HEIGHT], countries, rest, labels };
fs.writeFileSync(OUT, `${JSON.stringify(json)}\n`);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${countries.length} countries, ${WIDTH}×${HEIGHT}, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
