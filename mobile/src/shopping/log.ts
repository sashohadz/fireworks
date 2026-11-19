/** What hydration did, newest first, for the Log sheet: the proof on screen that the app answered Firework. */
export interface LogEntry {
  at: Date;
  mode: string;
  via?: string;
  /** IDs as Firework sent them (can repeat). */
  asked: string[];
  found: { id: string; summary: string }[];
  unknown: string[];
  ms: number;
  video?: string;
  error?: string;
}

const MAX = 50;
let entries: LogEntry[] = [];
const listeners = new Set<(e: LogEntry[]) => void>();

export const getLog = () => entries;

export function addLog(e: LogEntry) {
  entries = [e, ...entries].slice(0, MAX);
  listeners.forEach((l) => l(entries));
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
