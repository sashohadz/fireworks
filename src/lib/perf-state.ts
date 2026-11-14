// The performance view's state and its URL form: ?view=product&with=pdp,ava&load=lazy&net=fast4g&numbers=1.
// Not "widgets": that parameter filters the widgets of the page it is on (see settings.ts).
import type { PerfReport } from './perf';
import type { ViewState } from './perf-view';

export type { ViewState };

/** What the view opens with: the product page with a Storyblock, standard loading. */
export function defaultState(report: PerfReport): ViewState {
  const page = report.pages.find((p) => p.id === 'product') ?? report.pages[0]!;
  return { page: page.id, widgets: [...page.defaults], load: 'on', net: 'slow4g', numbers: false };
}

/** Reads the state from a query string. Unknown pages, widgets and modes are ignored. */
export function parseState(search: string, report: PerfReport): ViewState | null {
  const q = new URLSearchParams(search);
  if (!q.has('view') && !q.has('with') && !q.has('load') && !q.has('net') && !q.has('numbers')) return null;
  const base = defaultState(report);
  const page = report.pages.find((p) => p.id === q.get('view')) ?? report.pages.find((p) => p.id === base.page)!;
  const keys = page.widgets.map((w) => w.key);
  const asked = q.has('with') ? (q.get('with') ?? '').split(',') : page.id === base.page ? base.widgets : page.defaults;
  const widgets = keys.filter((k) => asked.includes(k));
  const load = q.get('load') === 'lazy' ? 'lazy' : 'on';
  const net = q.get('net') === 'fast4g' ? 'fast4g' : 'slow4g';
  return { page: page.id, widgets, load, net, numbers: q.get('numbers') === '1' };
}

export function stateQuery(state: ViewState, report: PerfReport): string {
  const base = defaultState(report);
  if (state.page === base.page && state.widgets.join() === base.widgets.join() && state.load === base.load && state.net === base.net && !state.numbers) return '';
  const q = new URLSearchParams({ view: state.page, with: state.widgets.join(','), load: state.load === 'lazy' ? 'lazy' : 'standard' });
  if (state.net !== 'slow4g') q.set('net', state.net);
  if (state.numbers) q.set('numbers', '1');
  return q.toString();
}
