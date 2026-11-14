// HTML for the visual performance view on /lab/performance. Pure functions from the measured data to markup, used
// on the server for the first paint and in the browser when a switch changes. All text from data goes through esc().
import { PHONE, REVEAL_AFTER_MS, laneLabels, netProfiles, setupId, type LaneId, type NetProfile, type PerfPageId, type PerfReport, type PerfResult } from './perf';
import {
  ALMANAC_MOBILE_HOME_BYTES,
  fmtCls,
  fmtKb,
  fmtMs,
  measuredNets,
  pageOf,
  ratingLevel,
  ratingOf,
  resultOf,
  revealOf,
  signed,
  speedVerdict,
  stillVerdict,
  tapBands,
  tapVerdict,
  trio,
  weightParts,
  weightShare,
  type Level,
  type Trio,
  type ViewState,
} from './perf-view';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(2)}%`;

/** Status colours from the dataviz palette. They always come with an icon and a label. */
const LEVEL_ICON: Record<Level, string> = { ok: '●', edge: '◐', warn: '▲', bad: '■' };
export const MAP_WIDTH = 180;

// ---------- icons (24px line icons, currentColor) ----------
const icon = (body: string) => `<svg class="pv-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const icons = {
  phone: icon('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>'),
  signal: icon('<path d="M4 19v-2M9 19v-5"/><path d="M14 19v-8M19 19V8" opacity=".3"/>'),
  empty: icon('<path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/>'),
  repeat: icon('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
  gauge: icon('<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1"/>'),
  speed: icon('<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/>'),
  tap: icon('<path d="M9 11V5a2 2 0 0 1 4 0v6"/><path d="M13 9a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 4 13.5V12a2 2 0 0 1 4 0"/>'),
  still: icon('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/>'),
  weight: icon('<path d="M6 8h12l2 12H4L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>'),
  lazy: icon('<path d="M12 4v10M8 10l4 4 4-4"/><path d="M5 20h14"/>'),
  widgets: icon('<rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="6" rx="1.5"/><path d="M14 15h7M14 19h4"/>'),
  map: icon('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>'),
  consent: icon('<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>'),
};

// ---------- shared pieces ----------

const badge = (level: Level, label: string) => `<span class="pv-badge pv-badge-${level}"><span aria-hidden="true">${LEVEL_ICON[level]}</span> ${esc(label)}</span>`;

/** What each title means, in plain words first and the metric's name for engineers after. */
export const tipTexts = {
  speed: 'When the main image or text on the first screen appears. Google’s Largest Contentful Paint: good under 2.5 s.',
  tap: 'The longest moment the phone is too busy to react to a tap while the page loads. Under 100 ms feels instant. Engineers: the longest main-thread task.',
  still: 'Whether things jump while the page loads, so a shopper doesn’t tap the wrong thing. Google’s Cumulative Layout Shift: good under 0.1.',
  weight: 'Data the phone downloads before any video plays, against the same page without Firework. Video (striped) streams only while it plays.',
  blocking: 'Time the page couldn’t respond to taps while loading. Lighthouse’s Total Blocking Time.',
} as const;

/**
 * A small ⓘ button with a tooltip: shown on hover and keyboard focus (CSS), and toggled by a tap
 * (perf-configurator.ts), so it also works on phones.
 */
export const tip = (key: keyof typeof tipTexts, label: string) =>
  `<span class="pv-tip"><button type="button" class="pv-tip-btn" aria-label="What “${esc(label)}” means" aria-describedby="pv-tip-${key}"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.2v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="4.9" r="1" fill="currentColor"/></svg></button><span role="tooltip" id="pv-tip-${key}" class="pv-tip-text">${esc(tipTexts[key])}</span></span>`;

export const MARKERS = [
  { mode: 'off' as const, label: 'Without Firework', short: 'Without' },
  { mode: 'on' as const, label: 'Standard loading', short: 'Standard' },
  { mode: 'lazy' as const, label: 'Lazy loading', short: 'Lazy' },
];

const markerSvg = (mode: 'off' | 'on' | 'lazy', x: number, y: number, big: boolean) => {
  const r = big ? 6 : 4.5;
  if (mode === 'off') return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#14212b" stroke-width="2"/>`;
  if (mode === 'on') return `<circle cx="${x}" cy="${y}" r="${r}" fill="#14212b" stroke="#fff" stroke-width="2"/>`;
  return `<path d="M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z" fill="#2a78d6" stroke="#fff" stroke-width="2"/>`;
};

export const markerLegend = () =>
  `<ul class="pv-legend" aria-label="Markers">${MARKERS.map(
    (m) => `<li><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${markerSvg(m.mode, 8, 8, false)}</svg>${esc(m.label)}</li>`,
  ).join('')}</ul>`;

/**
 * A band with coloured zones and one row per mode (without / standard / lazy), each with its marker: a small dot plot
 * on Google's (or the research's) scale. The selected mode is drawn larger.
 */
function band(opts: {
  zones: { upTo: number; level: Level; label?: string }[];
  max: number;
  values: Record<'off' | 'on' | 'lazy', number>;
  selected: 'on' | 'lazy';
  ticks: { at: number; label: string }[];
  title: string;
}): string {
  const W = 300;
  const left = 58;
  const plot = W - left - 6;
  const x = (v: number) => left + (Math.max(0, Math.min(v, opts.max)) / opts.max) * plot;
  let from = 0;
  const zones = opts.zones
    .map((z) => {
      const to = Math.min(z.upTo, opts.max);
      const rect = to > from ? `<rect x="${x(from).toFixed(1)}" y="2" width="${(x(to) - x(from)).toFixed(1)}" height="66" class="z z-${z.level}"/>` : '';
      from = to;
      return rect;
    })
    .join('');
  const rows = MARKERS.map((m, i) => {
    const y = 14 + i * 20;
    const v = opts.values[m.mode];
    const sel = m.mode === opts.selected;
    return `<text x="0" y="${y + 4}" class="rl${sel ? ' sel' : ''}">${esc(m.short)}</text><line x1="${left}" x2="${W - 6}" y1="${y}" y2="${y}" class="rule"/>${markerSvg(m.mode, Number(x(v).toFixed(1)), y, sel)}`;
  }).join('');
  let lastEnd = -Infinity;
  const ticks = opts.ticks
    .filter((t) => t.at < opts.max)
    .map((t) => {
      const tx = x(t.at);
      // About 4.6px per character at 9px: skip a label that would run into the previous one.
      const half = (t.label.length * 4.6) / 2;
      const show = tx - half > lastEnd + 4;
      if (show) lastEnd = tx + half;
      return `<line x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="2" y2="68" class="tk"/>${show ? `<text x="${tx.toFixed(1)}" y="80" class="tl">${esc(t.label)}</text>` : ''}`;
    })
    .join('');
  return `<svg class="pv-band" viewBox="0 0 ${W} 84" role="img" aria-label="${esc(opts.title)}">${zones}${ticks}${rows}</svg>`;
}

// ---------- 0. how we test ----------

export function renderMethod(state: ViewState, report: PerfReport): string {
  const runs = report.conditions?.runs ?? 3;
  const net = netProfiles[state.net];
  const steps = [
    { icon: icons.phone, big: 'Mid-range phone', small: 'Moto G Power, 4× slower CPU' },
    { icon: icons.signal, big: net.label, small: `${net.speed}, ${net.rttMs} ms round trip` },
    { icon: icons.empty, big: 'First visit', small: 'nothing cached' },
    { icon: icons.repeat, big: `${runs} run${runs === 1 ? '' : 's'}`, small: runs > 1 ? 'middle one counts' : 'single run' },
    { icon: icons.gauge, big: 'Google Lighthouse', small: 'Google’s own test' },
  ];
  return `<ol class="pv-method-steps">${steps.map((m) => `<li>${m.icon}<span><b>${esc(m.big)}</b><small>${esc(m.small)}</small></span></li>`).join('')}</ol>
    ${renderReal(state, report)}`;
}

/**
 * The note next to the test steps: how common the chosen connection is, and Google's 3-of-4 rule. With the Chrome UX
 * Report data on the page it says how many phone visits in Europe are this slow, and opens the map by country.
 */
function renderReal(state: ViewState, report: PerfReport): string {
  const conn = report.connections;
  const net = netProfiles[state.net];
  const slow = conn ? Math.round(conn.europe.high * 100) : null;
  const sentence =
    state.net === 'fast4g' ? 'a typical mobile connection.' : slow !== null ? `about ${slow} in 100 phone visits in Europe are this slow${conn?.sample ? ' (sample data)' : ''}.` : 'slower than 85% of mobile visits.';
  const inner = `<span class="pv-real-phones" aria-hidden="true" title="Google rates a page on real visits, at the 75th percentile"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></span>
      <span><b>${esc(net.label)}:</b> ${esc(sentence)} Google rates real visits: 3 of 4 must be fast.${conn ? `<span class="pv-real-more">${icons.map}By country</span>` : ''}</span>`;
  return conn
    ? `<button type="button" class="pv-real" aria-haspopup="dialog" aria-expanded="false" aria-controls="pv-netmap">${inner}</button>`
    : `<div class="pv-real">${inner}</div>`;
}

// ---------- 1. switches ----------

export function renderControls(state: ViewState, report: PerfReport): string {
  const page = pageOf(state.page);
  const pages = report.pages
    .map((p) => `<button type="button" role="radio" aria-checked="${p.id === state.page}" data-page="${esc(p.id)}">${esc(p.label)}</button>`)
    .join('');
  const chips = page.widgets
    .map((w) => {
      const on = state.widgets.includes(w.key);
      return `<button type="button" role="switch" aria-checked="${on}" data-widget="${esc(w.key)}" class="pv-chip"><span class="pv-chip-box" aria-hidden="true">${on ? '✓' : ''}</span>${esc(w.label)}</button>`;
    })
    .join('');
  const load = (['on', 'lazy'] as const)
    .map((m) => `<button type="button" role="radio" aria-checked="${state.load === m}" data-load="${m}">${m === 'on' ? 'Standard' : 'Lazy'}</button>`)
    .join('');
  const measured = measuredNets(report);
  const nets = (['slow4g', 'fast4g'] as NetProfile[])
    .map((n) => {
      const off = !measured.includes(n);
      return `<button type="button" role="radio" aria-checked="${state.net === n}" data-net="${n}"${off ? ' disabled title="Not measured yet"' : ''}>${esc(netProfiles[n].label)}</button>`;
    })
    .join('');
  return `
    <div class="pv-control"><span class="pv-control-label">Page</span><div class="pv-seg" role="radiogroup" aria-label="Page">${pages}</div></div>
    <div class="pv-control"><span class="pv-control-label">Firework on it</span><div class="pv-chips" role="group" aria-label="Widgets">${chips}</div>${state.widgets.length ? '' : '<span class="pv-hint">Script only, no widgets</span>'}</div>
    <div class="pv-control"><span class="pv-control-label">Loading</span><div class="pv-seg" role="radiogroup" aria-label="Loading">${load}</div></div>
    <div class="pv-control"><span class="pv-control-label">Connection</span><div class="pv-seg" role="radiogroup" aria-label="Connection">${nets}</div></div>
    <label class="pv-switch"><input type="checkbox" data-numbers ${state.numbers ? 'checked' : ''}/><span aria-hidden="true"></span>Show numbers</label>`;
}

// ---------- 2. the page in a phone ----------

export function renderPhone(state: ViewState, report: PerfReport): string {
  const id = setupId(state.page, state.widgets);
  const map = report.pageMaps[id] ?? report.pageMaps[setupId(state.page, null)];
  const page = pageOf(state.page);
  const openUrl = `${page.path}?widgets=${state.widgets.join(',')}&fw=${state.load}`;
  if (!map) return `<div class="pv-phone-frame"><p class="pv-empty">No page map yet.</p></div>`;
  const scale = MAP_WIDTH / PHONE.width;
  const h = Math.round(map.height * scale);
  // The whole page as a strip next to the phone: where the first screen ends and where each widget sits.
  const STRIP_H = 400;
  const sScale = STRIP_H / map.height;
  const strip = map.boxes
    .map((b) => {
      const below = b.fixed || b.top >= PHONE.height;
      const later = state.load === 'lazy' && below && b.key !== 'ava';
      const top = b.fixed ? PHONE.height - b.height - 12 : b.top;
      return `<button type="button" class="pv-strip-bar ${later ? 'is-later' : 'is-now'}" style="top:${Math.round(top * sScale)}px;height:${Math.max(6, Math.round(b.height * sScale))}px" data-scroll-to="${Math.max(0, Math.round((top - 40) * scale))}" title="${esc(b.label)}: ${later ? 'loads on scroll' : 'loads with the page'}" aria-label="Show the ${esc(b.label)}"></button>`;
    })
    .join('');
  const boxes = map.boxes
    .map((b) => {
      const below = b.fixed || b.top >= PHONE.height;
      const later = state.load === 'lazy' && below && b.key !== 'ava';
      const top = b.fixed ? Math.round((PHONE.height - b.height - 12) * scale) : Math.round(b.top * scale);
      return `<div class="pv-box ${later ? 'is-later' : 'is-now'}" style="top:${top}px;left:${Math.round(b.left * scale)}px;width:${Math.max(24, Math.round(b.width * scale))}px;height:${Math.max(14, Math.round(b.height * scale))}px">
        <span>${esc(b.label)}<em>${later ? 'Loads on scroll' : 'Loads with the page'}</em></span></div>`;
    })
    .join('');
  return `
    <div class="pv-phone-row">
    <div class="pv-phone-frame" aria-label="The whole ${esc(page.label.toLowerCase())} as a phone shows it">
      <div class="pv-phone-screen">
        <div class="pv-map" style="height:${h}px">
          <img src="${esc(map.src)}" width="${MAP_WIDTH}" height="${h}" alt="The whole ${esc(page.label.toLowerCase())}" loading="eager" decoding="async"/>
          <div class="pv-fold" style="top:${Math.round(PHONE.height * scale)}px"><span>First screen ↑</span></div>
          ${boxes}
        </div>
      </div>
    </div>
    <div class="pv-strip" style="height:${STRIP_H}px" aria-label="Where the widgets sit on the whole page">
      <span class="pv-strip-fold" style="top:${Math.round(PHONE.height * sScale)}px" title="End of the first screen"></span>
      ${strip}
    </div>
    </div>
    <a class="pv-open small" href="${esc(openUrl)}" target="_blank" rel="noopener">Open this page ↗</a>`;
}

// ---------- 3. the four verdict tiles ----------

function tileShell(iconSvg: string, question: string, tipKey: keyof typeof tipTexts, verdictHtml: string, visual: string, numbers: string, state: ViewState): string {
  return `<article class="pv-tile">
    <header>${iconSvg}<h3>${esc(question)}</h3>${tip(tipKey, question)}</header>
    <div class="pv-verdict">${verdictHtml}</div>
    ${visual}
    ${state.numbers ? `<p class="pv-nums">${numbers}</p>` : ''}
  </article>`;
}

const nums = (t: Trio, f: (r: PerfResult) => string) => MARKERS.map((m) => `${esc(m.short)} <b>${f(t[m.mode])}</b>`).join(' · ');

export function renderTiles(state: ViewState, report: PerfReport): string {
  const t = trio(report, state.page, state.widgets, state.net);
  if (!t) return `<p class="pv-empty">This combination hasn't been measured on ${esc(netProfiles[state.net].label)} yet.</p>`;
  const sel = t[state.load];

  // Loads as fast?
  const speed = speedVerdict(t.off, sel);
  const lcpMax = Math.max(5000, ...MARKERS.map((m) => t[m.mode].lighthouse.lcp)) * 1.08;
  const speedTile = tileShell(
    iconsHtml('speed'),
    'Loads as fast?',
    'speed',
    `<strong>${esc(speed.headline)}</strong>${badge(speed.level, speed.label)}`,
    band({
      title: 'Time until the main content shows, on Google’s scale',
      zones: [
        { upTo: 2500, level: 'ok' },
        { upTo: 4000, level: 'warn' },
        { upTo: Infinity, level: 'bad' },
      ],
      max: lcpMax,
      values: { off: t.off.lighthouse.lcp, on: t.on.lighthouse.lcp, lazy: t.lazy.lighthouse.lcp },
      selected: state.load,
      ticks: [
        { at: 2500, label: 'Good ≤ 2.5 s' },
        { at: 4000, label: '4 s' },
      ],
    }),
    `Main content: ${nums(t, (r) => fmtMs(r.lighthouse.lcp))}. Google: ${esc(ratingOf('lcp', sel.lighthouse.lcp).label.toLowerCase())}.${
      speed.worst > 100 ? ` Slowest run +${fmtMs(speed.worst)}.` : ''
    }${speed.moved ? ' The videos push the main image below the first screen.' : ''}`,
    state,
  );

  // Responds to taps?
  const tap = tapVerdict(sel.runtime.longestTaskMs);
  const tapMax = Math.max(400, ...MARKERS.map((m) => t[m.mode].runtime.longestTaskMs)) * 1.08;
  const tapTile = tileShell(
    iconsHtml('tap'),
    'Responds to taps?',
    'tap',
    `<strong>${esc(tap.label)}</strong>${badge(tap.level, `${fmtMs(sel.runtime.longestTaskMs)} pause`)}`,
    band({
      title: 'Longest pause a tap could hit while loading, on the perception scale',
      zones: tapBands,
      max: tapMax,
      values: { off: t.off.runtime.longestTaskMs, on: t.on.runtime.longestTaskMs, lazy: t.lazy.runtime.longestTaskMs },
      selected: state.load,
      ticks: [
        { at: 100, label: 'Instant ≤ 100' },
        { at: 200, label: '200' },
        { at: 300, label: '300 ms' },
      ],
    }),
    `Longest pause, ${sel.runs > 1 ? `shortest of ${sel.runs} runs` : 'one run'}: ${nums(t, (r) => fmtMs(r.runtime.longestTaskMs))}. Blocking time ${fmtMs(sel.lighthouse.tbt)} (Lighthouse: ${esc(ratingOf('tbt', sel.lighthouse.tbt).label.toLowerCase())}).`,
    state,
  );

  // Stays still?
  const still = stillVerdict(sel.lighthouse.cls);
  const stillTile = tileShell(
    iconsHtml('still'),
    'Stays still?',
    'still',
    `<strong>${esc(still.headline)}</strong>${badge(still.level, `Layout shift ${fmtCls(sel.lighthouse.cls)}`)}`,
    band({
      title: 'How much the page moves while loading, on Google’s scale',
      zones: [
        { upTo: 0.1, level: 'ok' },
        { upTo: 0.25, level: 'warn' },
        { upTo: Infinity, level: 'bad' },
      ],
      max: 0.3,
      values: { off: t.off.lighthouse.cls, on: t.on.lighthouse.cls, lazy: t.lazy.lighthouse.cls },
      selected: state.load,
      ticks: [
        { at: 0.1, label: 'Good ≤ 0.1' },
        { at: 0.25, label: '0.25' },
      ],
    }),
    `Layout shift: ${nums(t, (r) => fmtCls(r.lighthouse.cls))}. Google: ${esc(ratingOf('cls', sel.lighthouse.cls).label.toLowerCase())}.`,
    state,
  );

  // How much heavier?
  const parts = MARKERS.map((m) => ({ m, p: weightParts(t[m.mode]) }));
  const added = parts.find((x) => x.m.mode === state.load)!.p;
  const offParts = parts[0]!.p;
  const addedBytes = added.page + added.firework - (offParts.page + offParts.firework);
  const wMax = Math.max(ALMANAC_MOBILE_HOME_BYTES * 1.04, ...parts.map((x) => x.p.page + x.p.firework + x.p.video)) * 1.02;
  const bars = parts
    .map(({ m, p }) => {
      const sel = m.mode === state.load;
      return `<div class="pv-wrow${sel ? ' sel' : ''}"><span class="rl">${esc(m.short)}</span><div class="pv-wbar">
        <span class="seg seg-page" style="width:${pct(p.page, wMax)}" title="Your page ${fmtKb(p.page)}"></span>${
          p.firework > 1024 ? `<span class="seg seg-fw" style="width:${pct(p.firework, wMax)}" title="Firework ${fmtKb(p.firework)}"></span>` : ''
        }${p.video > 50 * 1024 ? `<span class="seg seg-video" style="width:${pct(p.video, wMax)}" title="Video while it plays ${fmtKb(p.video)}"></span>` : ''}
      </div></div>`;
    })
    .join('');
  const weightTile = tileShell(
    iconsHtml('weight'),
    'How much heavier?',
    'weight',
    `<strong>${addedBytes > 1024 ? signed(fmtKb(addedBytes), true) : 'Nothing'}</strong><span class="pv-badge pv-badge-neutral">≈ ${esc(weightShare(Math.max(0, addedBytes)))}</span>`,
    `<div class="pv-weight" role="img" aria-label="Page weight without Firework, with standard and with lazy loading">${bars}
      <div class="pv-wref" style="left:calc(58px + (100% - 64px) * ${(ALMANAC_MOBILE_HOME_BYTES / wMax).toFixed(4)})"><span>Typical page 2.6 MB</span></div></div>
     <ul class="pv-wlegend"><li><i class="seg-page"></i>Your page</li><li><i class="seg-fw"></i>Firework</li><li><i class="seg-video"></i>Video, only while playing</li></ul>`,
    `Before any video plays: ${nums(t, (r) => fmtKb(weightParts(r).page + weightParts(r).firework))}. Requests ${nums(t, (r) => String(r.network.requests))}.`,
    state,
  );

  return `${markerLegend()}<div class="pv-tiles">${speedTile}${tapTile}${stillTile}${weightTile}</div>`;
}

function iconsHtml(name: keyof typeof icons): string {
  return icons[name];
}

// ---------- 4. what the shopper sees ----------

export function renderFilm(state: ViewState, report: PerfReport): string {
  const t = trio(report, state.page, state.widgets, state.net);
  if (!t) return '';
  const lcps = MARKERS.map((m) => t[m.mode].lighthouse.lcp);
  const end = Math.min(9000, Math.max(2500, Math.ceil((Math.max(...lcps) * 1.25) / 500) * 500));
  const cols = 6;
  const times = Array.from({ length: cols }, (_, i) => Math.round(((i + 1) * end) / cols / 100) * 100);
  const head = `<div class="pv-film-row pv-film-head"><span></span>${times.map((ms) => `<span>${(ms / 1000).toFixed(1)} s</span>`).join('')}</div>`;
  const rows = MARKERS.map((m) => {
    const r = t[m.mode];
    const film = r.film ?? [];
    const frameAt = (ms: number) => [...film].reverse().find((f) => f.t <= ms) ?? film[0];
    const lcpCol = times.findIndex((ms) => (frameAt(ms)?.t ?? 0) >= r.lighthouse.lcp);
    const cells = times
      .map((ms, i) => {
        const frame = frameAt(ms);
        // A frame captured before the first paint shows nothing yet (it comes out black, white or grey).
        const blank = !frame || frame.t < r.lighthouse.fcp;
        const img = blank ? '<span class="pv-blank">Blank screen</span>' : `<img src="${esc(frame.src)}" alt="" width="70" height="140" loading="lazy" decoding="async"/>`;
        return `<span class="pv-frame${i === lcpCol ? ' is-lcp' : ''}">${img}${i === lcpCol ? '<em>Main content</em>' : ''}</span>`;
      })
      .join('');
    const sel = m.mode === state.load || m.mode === 'off';
    return `<div class="pv-film-row${m.mode === state.load ? ' sel' : ''}${sel ? '' : ' dim'}"><span class="rl"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">${markerSvg(m.mode, 8, 8, false)}</svg>${esc(m.short)}${state.numbers ? ` <small>${fmtMs(r.lighthouse.lcp)}</small>` : ''}</span>${cells}</div>`;
  }).join('');
  return `<div class="pv-film" role="img" aria-label="Loading filmstrip: what the shopper sees over time, without Firework, with standard and with lazy loading">${head}${rows}</div>`;
}

// ---------- 5. standard vs lazy ----------

const LANE_ORDER: LaneId[] = ['page', 'script', 'media', 'tracking', 'ava'];

function timeline(r: PerfResult, end: number, label: string, extra = ''): string {
  const lanes = LANE_ORDER.filter((l) => (r.lanes?.[l]?.length ?? 0) > 0);
  const rows = lanes
    .map(
      (l) => `<div class="pv-lane"><span class="ll">${esc(laneLabels[l])}</span><div class="pv-lane-track">${(r.lanes?.[l] ?? [])
        .map(([a, b]) => `<span class="pv-lane-bar lane-${l}" style="left:${pct(a, end)};width:${pct(Math.max(b - a, end * 0.004), end)}"></span>`)
        .join('')}</div></div>`,
    )
    .join('');
  return `<div class="pv-timeline"><p class="pv-tl-title">${label}</p>${rows}<div class="pv-tl-axis"><span class="ll"></span><div class="pv-lane-track"><span class="pv-lcp" style="left:${pct(r.lighthouse.lcp, end)}"><i>Main content</i></span>${extra}</div></div></div>`;
}

export function renderLazy(state: ViewState, report: PerfReport): string {
  const t = trio(report, state.page, state.widgets, state.net);
  if (!t) return '';
  const before = (r: PerfResult) => weightParts(r).page + weightParts(r).firework;
  const saved = before(t.on) - before(t.lazy);
  const tbtSaved = t.on.lighthouse.tbt - t.lazy.lighthouse.tbt;
  const lcpGain = t.on.lighthouse.lcp - t.lazy.lighthouse.lcp;
  const id = setupId(state.page, state.widgets);
  const reveal = revealOf(report, id, state.net);
  const other: NetProfile = state.net === 'slow4g' ? 'fast4g' : 'slow4g';
  const otherReveal = revealOf(report, id, other);
  const lazyLoadsAtOnce = t.lazy.runtime.sdkLoaded;
  const delta = (big: string, small: string, good: boolean, tipKey?: keyof typeof tipTexts) =>
    `<div class="pv-delta${good ? ' good' : ''}"><span class="big">${esc(big)}</span><span>${esc(small)}${tipKey ? tip(tipKey, small) : ''}</span></div>`;
  const deltas = lazyLoadsAtOnce
    ? `<p class="pv-lazy-note">${icons.widgets}<span>A widget is in the first screen, so lazy loading fetches Firework right away and changes little on this page.</span></p>`
    : `<div class="pv-deltas">
        ${delta(saved > 1024 ? signed(fmtKb(saved), false) : 'Same', 'loaded before the shopper scrolls', saved > 1024)}
        ${delta(tbtSaved > 20 ? signed(fmtMs(tbtSaved), false) : 'Same', 'blocking time', tbtSaved > 20, 'blocking')}
        ${delta(lcpGain > 100 ? `${fmtMs(lcpGain)} sooner` : 'Same', 'main content', lcpGain > 100)}
      </div>`;
  const end = Math.min(20000, Math.max(...[t.on, t.lazy].flatMap((r) => Object.values(r.lanes ?? {}).flat().map((iv) => iv[1])), t.on.lighthouse.lcp, 3000) * 1.05);
  // One row per connection: how long until the first video shows once the shopper scrolls to it. Same scale for both.
  const rows = [reveal, otherReveal].filter((r): r is NonNullable<typeof r> => Boolean(r));
  const maxMs = Math.max(1, ...rows.flatMap((r) => [r.lazyMs, r.standardMs]));
  const bar = (ms: number, cls: string, label: string) =>
    `<span class="pv-reveal-bar ${cls}" style="--w:${Math.min(100, (ms / maxMs) * 100).toFixed(1)}%"><b>${fmtMs(ms)}</b> ${esc(label)}</span>`;
  const revealHtml =
    reveal && !lazyLoadsAtOnce
      ? `<div class="pv-reveal"><p class="pv-reveal-step">↓ ${REVEAL_AFTER_MS / 1000} s after the page loaded, the shopper scrolls to the ${esc(reveal.widget)}. Until the first video shows:</p>
          ${rows
            .map(
              (r) => `<div class="pv-reveal-row${(r.profile ?? 'slow4g') === state.net ? ' sel' : ''}"><span class="pv-reveal-net">${esc(netProfiles[r.profile ?? 'slow4g'].label)}</span>
                <div class="pv-reveal-bars">${bar(r.lazyMs, '', 'lazy')}${bar(r.standardMs, 'std', 'standard')}</div></div>`,
            )
            .join('')}</div>`
      : '';
  return `${deltas}
    <div class="pv-timelines">
      ${timeline(t.on, end, 'Standard: everything loads with the page')}
      ${timeline(t.lazy, end, lazyLoadsAtOnce ? 'Lazy: Firework loads at once (widget in the first screen)' : 'Lazy: Firework waits until the shopper scrolls')}
      ${revealHtml}
    </div>
    <ul class="pv-wlegend">${LANE_ORDER.map((l) => `<li><i class="lane-${l}"></i>${esc(laneLabels[l])}</li>`).join('')}</ul>
    ${
      reveal && !lazyLoadsAtOnce
        ? `<p class="pv-tradeoff"><b>The trade-off:</b> on ${esc(netProfiles[state.net].label)}, the ${esc(reveal.widget)} takes ${fmtMs(reveal.lazyMs)} to show once the shopper gets there${reveal.standardMs > 300 ? `, against ${fmtMs(reveal.standardMs)} with standard loading` : ', where with standard loading it is already there'}${
            otherReveal ? `. On ${esc(netProfiles[other].label)}: ${fmtMs(otherReveal.lazyMs)} against ${fmtMs(otherReveal.standardMs)}` : ''
          }.</p>`
        : ''
    }`;
}

// ---------- 6. ways to improve ----------

export function renderLevers(state: ViewState, report: PerfReport): string {
  const page = pageOf(state.page);
  const offR = resultOf(report, setupId(state.page, null), 'off', state.net);
  const added = (keys: string[]) => {
    const r = resultOf(report, setupId(state.page, keys), 'on', state.net);
    return r && offR ? weightParts(r).page + weightParts(r).firework - (weightParts(offR).page + weightParts(offR).firework) : null;
  };
  const one = page.widgets[0] ? added([page.widgets[0].key]) : null;
  const all = added(page.widgets.map((w) => w.key));
  const t = trio(report, state.page, state.widgets, state.net);
  const lazySaved = t ? weightParts(t.on).page + weightParts(t.on).firework - (weightParts(t.lazy).page + weightParts(t.lazy).firework) : 0;
  const maxCls = Math.max(0, ...report.results.filter((r) => r.mode !== 'off').map((r) => r.lighthouse.cls));
  const card = (ic: string, title: string, big: string, small: string, cls = '') =>
    `<article class="pv-lever ${cls}">${ic}<h3>${esc(title)}</h3><p class="big">${esc(big)}</p><p class="small muted">${esc(small)}</p></article>`;
  return `<div class="pv-levers">
    ${card(icons.lazy, 'Lazy loading', lazySaved > 1024 ? signed(fmtKb(lazySaved), false) : 'Same', 'until the shopper scrolls to the videos. Firework’s own advice for fast first loads.')}
    ${card(icons.widgets, 'One or two widgets', one !== null && all !== null ? `${fmtKb(one)} vs ${fmtKb(all)}` : '–', `one widget vs all ${page.widgets.length} on the ${page.label.toLowerCase()}`)}
    ${card(icons.still, 'Reserve the space', `Shift ${fmtCls(maxCls)}`, 'a container with a minimum height per widget, so nothing jumps', 'ok')}
    ${card(icons.consent, 'Load after consent', 'Next', 'nothing loads for shoppers who decline; measured with the consent banner', 'next')}
  </div>`;
}

/** Ratings in the numbers view use Google's words; exported for the details page. */
export const levelOfRating = ratingLevel;
export type { PerfPageId };
