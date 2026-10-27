// Floating debug panel, shown on any page with ?debug (or when enabled in Settings).
// Lists fw:* events, shows SDK status and links to Firework's own telemetry console.
import { clearEventRecords, getEventRecords, onFwEvent, type FwEventRecord } from './event-tap';
import type { EffectiveSettings } from './settings';

const CSS = `
:host { all: initial; }
.panel { position: fixed; left: 12px; bottom: 12px; z-index: 2147483000; width: min(460px, calc(100vw - 24px));
  max-height: min(70vh, 640px); display: flex; flex-direction: column; background: #101b23; color: #e6edf1;
  font: 12.5px/1.45 ui-monospace, 'SF Mono', Menlo, Consolas, monospace; border-radius: 12px;
  box-shadow: 0 18px 48px rgb(0 0 0 / .35); border: 1px solid #2a3b46; }
.panel.min .status, .panel.min .tools, .panel.min ol { display: none; }
header { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #2a3b46; }
header strong { font-weight: 700; color: #fff; }
.count { background: #e8913a; color: #fff; border-radius: 999px; padding: 0 7px; font-size: 11px; }
.spacer { flex: 1; }
button { font: inherit; color: #e6edf1; background: #1d2d38; border: 1px solid #36505f; border-radius: 6px; padding: 3px 8px; cursor: pointer; }
button:hover { background: #26404f; }
.status { padding: 8px 10px; border-bottom: 1px solid #2a3b46; color: #a9bac4; display: grid; gap: 2px; }
.status b { color: #fff; font-weight: 600; }
.ok { color: #8fd19e; } .bad { color: #f19c9c; } .warn { color: #f3c37a; }
.tools { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px; border-bottom: 1px solid #2a3b46; }
input { flex: 1 1 140px; font: inherit; color: #fff; background: #0b141a; border: 1px solid #36505f; border-radius: 6px; padding: 4px 8px; }
ol { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
li { padding: 6px 10px; border-bottom: 1px solid #1d2a33; }
.t { color: #7f939f; margin-right: 6px; }
.type { color: #ffd29a; }
.target { color: #9cc6dc; margin-left: 6px; }
details { margin-top: 3px; }
summary { cursor: pointer; color: #7f939f; }
pre { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; color: #cfdbe2; max-height: 220px; overflow: auto; }
.empty { padding: 12px 10px; color: #7f939f; }
`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function formatRecordHtml(r: FwEventRecord): string {
  const detail = r.detail === undefined ? '' : JSON.stringify(r.detail, null, 2);
  return `<span class="t">+${(r.at / 1000).toFixed(2)}s</span><span class="type">${esc(r.type)}</span><span class="target">${esc(r.target)}</span>${
    detail ? `<details><summary>detail</summary><pre>${esc(detail)}</pre></details>` : ''
  }`;
}

function sdkStatusHtml(settings: EffectiveSettings): string {
  const loaded = Boolean(window._fwn);
  const tags = [...new Set([...document.querySelectorAll('*')].map((el) => el.localName).filter((n) => n.startsWith('fw-')))];
  const defined = tags.map((t) => `${t} ${customElements.get(t) ? '<span class="ok">defined</span>' : '<span class="warn">waiting</span>'}`);
  return [
    `<div>SDK: ${settings.fwMode === 'off' ? '<span class="warn">off (?fw=off)</span>' : loaded ? '<span class="ok">window._fwn loaded</span>' : '<span class="warn">loading…</span>'} · mode <b>${settings.fwMode}</b></div>`,
    `<div>Channel: <b>${esc(settings.channel || '(none)')}</b> from ${settings.channelSource}${settings.isSandbox ? ' · <span class="ok">sandbox</span>' : settings.channel ? ' · <span class="warn">not sandbox: purchase tracking off</span>' : ''}</div>`,
    `<div>Widgets: ${defined.length ? defined.join(' · ') : 'none on this page'}</div>`,
  ].join('');
}

export function mountDebugOverlay(settings: EffectiveSettings): void {
  if (document.getElementById('fjb-debug')) return;
  const host = document.createElement('div');
  host.id = 'fjb-debug';
  const root = host.attachShadow({ mode: 'open' });
  const debugFwn = new URL(location.href).searchParams.get('debug_fwn') === 'true';
  root.innerHTML = `<style>${CSS}</style>
    <section class="panel" aria-label="Firework debug overlay">
      <header><strong>Firework events</strong><span class="count">0</span><span class="spacer"></span>
        <button data-act="min" aria-label="Minimise">–</button><button data-act="close" aria-label="Close">×</button></header>
      <div class="status"></div>
      <div class="tools">
        <input type="search" placeholder="Filter, e.g. thumbnail" aria-label="Filter events">
        <button data-act="console" title="Runs window._fwn.console()">Telemetry console</button>
        <button data-act="debugfwn" title="Reloads with debug_fwn=true, which bypasses Firework sandbox mode">debug_fwn: ${debugFwn ? 'on' : 'off'}</button>
        <button data-act="copy">Copy JSON</button>
        <button data-act="clear">Clear</button>
      </div>
      <ol aria-live="polite"></ol>
    </section>`;
  document.body.appendChild(host);

  const panel = root.querySelector<HTMLElement>('.panel')!;
  const list = root.querySelector<HTMLOListElement>('ol')!;
  const count = root.querySelector<HTMLElement>('.count')!;
  const status = root.querySelector<HTMLElement>('.status')!;
  const filter = root.querySelector<HTMLInputElement>('input')!;

  const render = () => {
    const term = filter.value.trim().toLowerCase();
    const all = getEventRecords();
    const shown = all.filter((r) => !term || `${r.type} ${r.target}`.toLowerCase().includes(term)).slice(-200).reverse();
    count.textContent = String(all.length);
    list.innerHTML = shown.length
      ? shown.map((r) => `<li>${formatRecordHtml(r)}</li>`).join('')
      : '<li class="empty">No fw:* events yet. Scroll to a widget or click a video.</li>';
  };
  const refreshStatus = () => {
    status.innerHTML = sdkStatusHtml(settings);
  };

  onFwEvent(() => {
    render();
    refreshStatus();
  });
  filter.addEventListener('input', render);
  root.addEventListener('click', async (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (!act) return;
    if (act === 'close') host.remove();
    if (act === 'min') panel.classList.toggle('min');
    if (act === 'clear') {
      clearEventRecords();
      render();
    }
    if (act === 'copy') {
      await navigator.clipboard?.writeText(JSON.stringify(getEventRecords(), null, 2));
    }
    if (act === 'console') {
      if (window._fwn?.console) window._fwn.console();
      else alert('window._fwn is not loaded yet, so the telemetry console is unavailable.');
    }
    if (act === 'debugfwn') {
      const url = new URL(location.href);
      if (debugFwn) url.searchParams.delete('debug_fwn');
      else url.searchParams.set('debug_fwn', 'true');
      location.href = url.toString();
    }
  });

  render();
  refreshStatus();
  let ticks = 0;
  const timer = window.setInterval(() => {
    refreshStatus();
    if (++ticks > 20) window.clearInterval(timer);
  }, 1000);
}
