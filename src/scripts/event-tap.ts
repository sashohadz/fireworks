// Records every Firework event (type starting with "fw:") for the debug overlay and the lab.
// It wraps EventTarget.prototype.dispatchEvent before the Firework SDK loads, so it also catches
// event names that are not documented. Documented names are listened for on document as a backup.
// https://docs.firework.com/firework-for-developers/web/integration-guide/events

export interface FwEventRecord {
  id: number;
  /** Milliseconds since page load. */
  at: number;
  type: string;
  target: string;
  detail: unknown;
}

export const DOCUMENTED_EVENTS = [
  'fw:embed-feed:error',
  'fw:embed-feed:render',
  'fw:embed-feed:content-ready',
  'fw:embed-feed:impression',
  'fw:embed-feed:thumbnail-load',
  'fw:embed-feed:thumbnail-click',
  'fw:storyblock:render',
  'fw:storyblock:impression',
];

const MAX = 500;
const records: FwEventRecord[] = [];
const listeners = new Set<(record: FwEventRecord) => void>();
let installed = false;
let nextId = 1;

function describeTarget(target: EventTarget | null): string {
  if (!target) return 'unknown';
  if (target === document) return 'document';
  if (target === window) return 'window';
  if (target instanceof Element) {
    const name = target.getAttribute('name');
    return `<${target.tagName.toLowerCase()}${name ? ` name="${name}"` : ''}>`;
  }
  return target.constructor?.name ?? 'target';
}

function cloneDetail(detail: unknown): unknown {
  if (detail === undefined || detail === null) return detail;
  const seen = new WeakSet<object>();
  try {
    return JSON.parse(
      JSON.stringify(detail, (_key, value: unknown) => {
        if (typeof value === 'function') return '[function]';
        if (typeof Element !== 'undefined' && value instanceof Element) return `<${value.tagName.toLowerCase()}>`;
        if (value && typeof value === 'object') {
          if (seen.has(value)) return '[circular]';
          seen.add(value);
        }
        return value;
      }),
    );
  } catch {
    return String(detail);
  }
}

function record(event: Event, target: EventTarget | null): void {
  const entry: FwEventRecord = {
    id: nextId++,
    at: Math.round(performance.now()),
    type: event.type,
    target: describeTarget(target),
    detail: cloneDetail((event as CustomEvent).detail),
  };
  records.push(entry);
  if (records.length > MAX) records.shift();
  listeners.forEach((fn) => {
    try {
      fn(entry);
    } catch {
      /* a broken listener must not break the page */
    }
  });
}

export function installEventTap(): void {
  if (installed) return;
  installed = true;
  const seen = new WeakSet<Event>();
  const original = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function dispatchEvent(this: EventTarget, event: Event): boolean {
    try {
      if (typeof event?.type === 'string' && event.type.startsWith('fw:') && !seen.has(event)) {
        seen.add(event);
        record(event, this);
      }
    } catch {
      /* never interfere with dispatch */
    }
    return original.call(this, event);
  };
  for (const name of DOCUMENTED_EVENTS) {
    document.addEventListener(
      name,
      (event) => {
        if (!seen.has(event)) {
          seen.add(event);
          record(event, event.target);
        }
      },
      true,
    );
  }
  // Exposed for the Playwright smoke test and for quick console checks.
  window.__fjb = { ...(window.__fjb ?? {}), events: records };
}

export const isEventTapInstalled = () => installed;
export const getEventRecords = (): FwEventRecord[] => records.slice();
export function clearEventRecords(): void {
  records.length = 0;
}
export function onFwEvent(fn: (record: FwEventRecord) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
