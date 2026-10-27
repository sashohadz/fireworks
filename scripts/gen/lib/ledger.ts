// Spend ledger for paid generation. Committed to the repo so the team can see what content cost.
import fs from 'node:fs';
import { LEDGER_FILE } from './paths';

export interface LedgerEntry {
  at: string;
  kind: 'image' | 'video' | 'voice';
  model: string;
  ref: string;
  units: number;
  unit: 'image' | 'second' | 'char';
  usd: number;
}

function read(): LedgerEntry[] {
  if (!fs.existsSync(LEDGER_FILE)) return [];
  const parsed = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')) as { entries?: LedgerEntry[] };
  return parsed.entries ?? [];
}

export const totalSpent = (): number => Math.round(read().reduce((sum, e) => sum + e.usd, 0) * 10000) / 10000;

export function recordSpend(entry: Omit<LedgerEntry, 'at'>): void {
  const entries = read();
  entries.push({ at: new Date().toISOString(), ...entry, usd: Math.round(entry.usd * 10000) / 10000 });
  fs.writeFileSync(LEDGER_FILE, `${JSON.stringify({ note: 'Estimated fal.ai spend per generation call.', entries }, null, 2)}\n`);
}

/** Throws before a paid call that would push total spend over the cap. */
export class Budget {
  private reserved = 0;
  constructor(readonly cap: number) {}

  get spent(): number {
    return totalSpent();
  }

  remaining(): number {
    return Math.max(0, this.cap - this.spent - this.reserved);
  }

  assertCanSpend(usd: number, what: string): void {
    if (usd > this.remaining()) {
      throw new Error(
        `Budget cap reached: ${what} needs ~$${usd.toFixed(2)} but only $${this.remaining().toFixed(2)} of $${this.cap.toFixed(2)} is left. ` +
          'Raise GEN_MAX_USD in .env or pass --max-usd if this is intended.',
      );
    }
  }
}
