// Lab component page: attribute knobs, live rebuild, snippet, CSS variables and the event log.
import type { AttrDef, LabComponent } from '../lab/registry';
import { attrGroups } from '../lab/registry';
import { fullSnippet } from '../lib/snippet';
import { formatRecordHtml } from './debug-overlay';
import { getEventRecords, onFwEvent } from './event-tap';
import { effectiveSettings, playlistFor } from './settings';
import { toast } from './ui';

const ATTR_PREFIX = 'a.';
const CSS_PREFIX = 'css.';

export function initLabComponent(): void {
  const dataEl = document.getElementById('lab-data');
  if (!dataEl) return;
  const { component } = JSON.parse(dataEl.textContent ?? '{}') as { component: LabComponent };
  const settings = effectiveSettings();
  const stage = document.getElementById('lab-stage')!;
  const snippet = document.getElementById('lab-snippet')!;
  const form = document.getElementById('lab-knobs') as HTMLFormElement;
  const cssBox = document.getElementById('lab-css')!;
  const eventsList = document.getElementById('lab-events')!;

  // ---------- state ----------
  const baseState = (): Record<string, string> => {
    const s: Record<string, string> = {};
    if (settings.channel) s.channel = settings.channel;
    const playlist = component.usePlaylist ? playlistFor(settings, component.slot) : '';
    if (playlist) s.playlist = playlist;
    return { ...s, ...component.initial };
  };
  let attrs = baseState();
  const cssVars: Record<string, string> = {};
  const params = new URLSearchParams(location.search);
  for (const [key, value] of params) {
    if (key.startsWith(ATTR_PREFIX)) {
      const name = key.slice(ATTR_PREFIX.length);
      if (value === '') delete attrs[name];
      else attrs[name] = value;
    }
    if (key.startsWith(CSS_PREFIX)) cssVars[key.slice(CSS_PREFIX.length)] = value;
  }

  // ---------- rendering ----------
  const cleanAttrs = () => Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== ''));

  function rebuild(): void {
    stage.innerHTML = '';
    const current = cleanAttrs();
    if (!current.channel) {
      stage.innerHTML =
        '<div class="fw-placeholder"><p class="fw-placeholder-title">No channel yet</p><p>Type a channel name in the <strong>channel</strong> attribute, or set one in Settings.</p></div>';
    } else {
      const el = document.createElement(component.tag);
      for (const [k, v] of Object.entries(current)) el.setAttribute(k, v);
      el.dataset.lab = 'true';
      stage.appendChild(el);
    }
    snippet.textContent = fullSnippet(component.tag, current, cssVars);
  }

  function applyCss(): void {
    for (const name of component.cssVars) {
      const v = cssVars[name]?.trim();
      if (v) document.documentElement.style.setProperty(name, v);
      else document.documentElement.style.removeProperty(name);
    }
  }

  function shareUrl(): string {
    const url = new URL(location.pathname, location.origin);
    for (const [k, v] of Object.entries(attrs)) url.searchParams.set(`${ATTR_PREFIX}${k}`, v);
    for (const [k, v] of Object.entries(cssVars)) if (v.trim()) url.searchParams.set(`${CSS_PREFIX}${k}`, v);
    return url.toString();
  }

  let timer = 0;
  const scheduleRebuild = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      rebuild();
      history.replaceState(null, '', shareUrl());
    }, 350);
  };

  // ---------- knobs ----------
  function control(def: AttrDef): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'knob';
    const id = `knob-${def.name}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = def.name;
    let input: HTMLInputElement | HTMLSelectElement;
    if (def.type === 'enum' || def.type === 'boolean') {
      const select = document.createElement('select');
      const values = def.type === 'boolean' ? ['true', 'false'] : (def.values ?? []);
      select.append(new Option(def.default ? `default (${def.default})` : 'default', ''));
      values.forEach((v) => select.append(new Option(v, v)));
      input = select;
    } else {
      const text = document.createElement('input');
      text.type = def.type === 'number' ? 'number' : 'text';
      text.placeholder = def.default ?? '';
      text.spellcheck = false;
      text.autocomplete = 'off';
      input = text;
    }
    input.id = id;
    input.value = attrs[def.name] ?? '';
    input.classList.toggle('is-set', input.value !== '');
    input.addEventListener(def.type === 'enum' || def.type === 'boolean' ? 'change' : 'input', () => {
      const v = input.value.trim();
      if (v === '') delete attrs[def.name];
      else attrs[def.name] = v;
      input.classList.toggle('is-set', v !== '');
      scheduleRebuild();
    });
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = def.description;
    wrap.append(label, input, hint);
    return wrap;
  }

  function buildKnobs(): void {
    form.innerHTML = '';
    for (const group of attrGroups) {
      const defs = component.attrs.filter((a) => a.group === group);
      if (!defs.length) continue;
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'knob-group';
      const legend = document.createElement('legend');
      legend.textContent = group;
      fieldset.append(legend, ...defs.map(control));
      form.appendChild(fieldset);
    }
  }

  function buildCssKnobs(): void {
    cssBox.innerHTML = '';
    for (const name of component.cssVars) {
      const wrap = document.createElement('div');
      wrap.className = 'knob';
      const id = `css-${name}`;
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = name;
      const input = document.createElement('input');
      input.id = id;
      input.placeholder = 'e.g. 0, 12px, #2F5D73';
      input.value = cssVars[name] ?? '';
      input.classList.toggle('is-set', input.value !== '');
      input.addEventListener('input', () => {
        cssVars[name] = input.value;
        input.classList.toggle('is-set', input.value.trim() !== '');
        applyCss();
        snippet.textContent = fullSnippet(component.tag, cleanAttrs(), cssVars);
        history.replaceState(null, '', shareUrl());
      });
      wrap.append(label, input);
      cssBox.appendChild(wrap);
    }
  }

  // ---------- events ----------
  const documented = new Set(component.events);
  const addEvent = (html: string, highlight: boolean) => {
    eventsList.querySelector('.empty')?.remove();
    const li = document.createElement('li');
    li.innerHTML = html;
    if (highlight) li.style.borderLeft = '3px solid #e8913a';
    eventsList.prepend(li);
  };
  getEventRecords().forEach((r) => addEvent(formatRecordHtml(r), documented.has(r.type)));
  onFwEvent((r) => addEvent(formatRecordHtml(r), documented.has(r.type)));

  // ---------- buttons ----------
  document.getElementById('lab-rebuild')?.addEventListener('click', rebuild);
  document.getElementById('lab-reset')?.addEventListener('click', () => {
    attrs = baseState();
    for (const k of Object.keys(cssVars)) delete cssVars[k];
    applyCss();
    buildKnobs();
    buildCssKnobs();
    rebuild();
    history.replaceState(null, '', location.pathname);
  });
  document.getElementById('lab-copy-link')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast('Link copied. It reproduces these attributes and CSS variables.');
    } catch {
      toast('Copy failed. Copy the address bar instead.');
    }
  });
  document.getElementById('lab-telemetry')?.addEventListener('click', () => {
    if (window._fwn?.console) window._fwn.console();
    else toast('The Firework SDK has not loaded yet.');
  });

  buildKnobs();
  buildCssKnobs();
  applyCss();
  rebuild();
}
