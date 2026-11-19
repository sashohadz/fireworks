/**
 * What passed between Firework and the app, newest first, for the Log sheet: product hydration, Add to cart from the
 * player, and purchases reported to Firework. The proof on screen that the app answered.
 */
export type LogKind = 'hydration' | 'cart' | 'purchase';

export interface LogEntry {
  at: Date;
  kind: LogKind;
  /** e.g. "Live API", "−20% sale · Live API", "Add to cart", "Purchase". */
  title: string;
  ms?: number;
  video?: string;
  /** What Firework sent, e.g. "Firework asked for: FJB-101, FJB-103". */
  request?: string;
  /** The app's answer, one line each; ok false is shown as ✗. */
  lines: { ok: boolean; text: string }[];
  note?: string;
}

const MAX = 60;
let entries: LogEntry[] = [];
const listeners = new Set<(e: LogEntry[]) => void>();

export const getLog = () => entries;

export function addLog(e: LogEntry) {
  entries = [e, ...entries].slice(0, MAX);
  listeners.forEach((l) => l(entries));
  // Also in adb logcat (tag ReactNativeJS), to follow along from a computer.
  console.log(`[${e.kind}] ${e.title}${e.ms !== undefined ? ` · ${e.ms} ms` : ''} · ${e.request ?? ''} · ${e.lines.map((l) => `${l.ok ? '✓' : '✗'} ${l.text}`).join(' | ')}`);
}

export function clearLog() {
  entries = [];
  listeners.forEach((l) => l(entries));
}

export function onLog(l: (e: LogEntry[]) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
