// The switches on /lab/performance: page, widgets, standard or lazy loading, and "Show numbers". Re-renders the
// visuals from the measured data embedded in the page, and keeps the state in the URL so a pitch link opens preset.
// URL values are allowlisted: anything that isn't a known page, widget or mode is ignored.
import type { PerfReport } from '../lib/perf';
import { renderControls, renderFilm, renderLazy, renderLevers, renderPhone, renderTiles } from '../lib/perf-render';
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
    render();
    // Keep keyboard focus on the same switch after the re-render.
    const key = btn.dataset.page ? `[data-page="${btn.dataset.page}"]` : btn.dataset.widget ? `[data-widget="${btn.dataset.widget}"]` : `[data-load="${btn.dataset.load}"]`;
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
}
