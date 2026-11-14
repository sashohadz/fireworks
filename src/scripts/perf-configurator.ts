// The switches on /lab/performance: page, widgets, standard or lazy loading, and "Show numbers". Re-renders the
// visuals from the measured data embedded in the page, and keeps the state in the URL so a pitch link opens preset.
// URL values are allowlisted: anything that isn't a known page, widget or mode is ignored.
import type { PerfReport } from '../lib/perf';
import { renderControls, renderFilm, renderLazy, renderLevers, renderMethod, renderPhone, renderTiles } from '../lib/perf-render';
import { defaultState, parseState, stateQuery, type ViewState } from '../lib/perf-state';

export function mountPerformanceView(): void {
  const dataEl = document.getElementById('pv-data');
  if (!dataEl) return;
  const report = JSON.parse(dataEl.textContent ?? '{}') as PerfReport;
  const region = (id: string) => document.getElementById(id);
  const controls = region('pv-controls');
  if (!controls) return;
  let state: ViewState = parseState(location.search, report) ?? defaultState(report);

  const render = () => {
    const parts: [string, (s: ViewState, r: PerfReport) => string][] = [
      ['pv-method', renderMethod],
      ['pv-controls', renderControls],
      ['pv-phone', renderPhone],
      ['pv-tiles', renderTiles],
      ['pv-film', renderFilm],
      ['pv-lazy', renderLazy],
      ['pv-levers', renderLevers],
    ];
    for (const [id, fn] of parts) {
      const el = region(id);
      if (el) el.innerHTML = fn(state, report);
    }
    document.getElementById('pv-app')?.classList.toggle('pv-numbers', state.numbers);
    // The map panel lives outside the re-rendered regions; keep the new trigger's state in step with it.
    document.querySelector('button.pv-real')?.setAttribute('aria-expanded', String(document.getElementById('pv-netmap')?.classList.contains('open') ?? false));
    const query = stateQuery(state, report);
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  };

  controls.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    const page = report.pages.find((p) => p.id === btn.dataset.page);
    if (page) state = { ...state, page: page.id, widgets: [...page.defaults] };
    const widget = btn.dataset.widget;
    if (widget) {
      const order = report.pages.find((p) => p.id === state.page)!.widgets.map((w) => w.key);
      const next = state.widgets.includes(widget) ? state.widgets.filter((w) => w !== widget) : [...state.widgets, widget];
      state = { ...state, widgets: order.filter((k) => next.includes(k)) };
    }
    if (btn.dataset.load === 'on' || btn.dataset.load === 'lazy') state = { ...state, load: btn.dataset.load };
    if ((btn.dataset.net === 'slow4g' || btn.dataset.net === 'fast4g') && !btn.disabled) state = { ...state, net: btn.dataset.net };
    render();
    // Keep keyboard focus on the same switch after the re-render.
    const key = btn.dataset.page
      ? `[data-page="${btn.dataset.page}"]`
      : btn.dataset.widget
        ? `[data-widget="${btn.dataset.widget}"]`
        : btn.dataset.net
          ? `[data-net="${btn.dataset.net}"]`
          : `[data-load="${btn.dataset.load}"]`;
    controls.querySelector<HTMLElement>(key)?.focus();
  });
  // The page strip next to the phone scrolls the phone to a widget.
  region('pv-phone')?.addEventListener('click', (e) => {
    const bar = (e.target as HTMLElement).closest<HTMLElement>('[data-scroll-to]');
    if (!bar) return;
    region('pv-phone')?.querySelector('.pv-phone-screen')?.scrollTo({ top: Number(bar.dataset.scrollTo) || 0, behavior: 'smooth' });
  });

  controls.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    if (!box.matches('[data-numbers]')) return;
    state = { ...state, numbers: box.checked };
    render();
    controls.querySelector<HTMLElement>('[data-numbers]')?.focus();
  });

  // The server rendered the default state; render again only if the URL asks for another one.
  if (stateQuery(state, report) !== stateQuery(defaultState(report), report)) render();
  mountTips();
  mountNetMap();
}

/** ⓘ tooltips: hover and focus are CSS; a tap (or click) pins one open, a tap elsewhere or Esc closes it. */
function mountTips(): void {
  const closeAll = (except?: Element | null) =>
    document.querySelectorAll('.pv-tip.open').forEach((t) => {
      if (t !== except) t.classList.remove('open');
    });
  document.addEventListener('click', (e) => {
    const tip = (e.target as HTMLElement).closest('.pv-tip-btn')?.parentElement ?? null;
    closeAll(tip);
    tip?.classList.toggle('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
}

/**
 * The "By country" map: hover opens it (CSS), a click or tap pins it, Esc, × or a click outside closes it. Hovering a
 * country shows its three shares in the readout; leaving the countries shows Europe again.
 */
function mountNetMap(): void {
  const pop = document.getElementById('pv-netmap');
  const svg = pop?.querySelector<SVGSVGElement>('svg.pv-euro');
  const box = pop?.querySelector<HTMLElement>('.pv-rtt');
  if (!pop || !svg || !box) return;
  const trigger = () => document.querySelector<HTMLButtonElement>('button.pv-real');
  const setOpen = (open: boolean) => {
    pop.classList.toggle('open', open);
    trigger()?.setAttribute('aria-expanded', String(open));
  };
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button.pv-real')) return setOpen(!pop.classList.contains('open'));
    if (t.closest('[data-netmap-close]')) {
      setOpen(false);
      trigger()?.focus();
      return;
    }
    if (pop.classList.contains('open') && !pop.contains(t)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !pop.classList.contains('open')) return;
    setOpen(false);
    trigger()?.focus();
  });

  type Shares = { name: string; low: number; medium: number; high: number };
  const europe = JSON.parse(box.dataset.europe ?? '{}') as Shares;
  // Same as pctText in perf-netmap.ts: one decimal under 10%.
  const pct = (v: number) => (v < 0.1 ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`);
  const field = (k: string) => box.querySelector<HTMLElement>(`[data-r="${k}"]`);
  const show = (s: Shares) => {
    field('name')!.textContent = s.name;
    field('slow')!.textContent = `about ${Math.round(s.high * 100)} in 100`;
    for (const k of ['low', 'medium', 'high'] as const) {
      field(k)!.textContent = pct(s[k]);
      field(`bar-${k}`)!.style.width = `${(s[k] * 100).toFixed(1)}%`;
    }
  };
  const firstLabel = svg.querySelector('.pv-euro-label');
  let hot: SVGPathElement | null = null;
  svg.addEventListener('pointerover', (e) => {
    const path = (e.target as Element).closest<SVGPathElement>('path[data-iso]');
    if (!path || path === hot) return;
    hot?.classList.remove('hot');
    hot = path;
    // Bring it above its neighbours (but under the labels) so its outline shows all round.
    svg.insertBefore(path, firstLabel);
    path.classList.add('hot');
    const d = path.dataset;
    show({ name: d.name ?? '', low: Number(d.low), medium: Number(d.medium), high: Number(d.high) });
  });
  // A finger lifting also "leaves": on touch, keep the tapped country until another is tapped.
  svg.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    hot?.classList.remove('hot');
    hot = null;
    show(europe);
  });
}
