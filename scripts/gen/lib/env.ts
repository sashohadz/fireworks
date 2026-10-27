import fs from 'node:fs';
import path from 'node:path';

/** Loads .env from the project root if it exists. .env is gitignored. */
export function loadEnv(): void {
  const file = path.join(process.cwd(), '.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill it in. Never commit .env.`);
  }
  return value;
}

/** Total generation budget in USD across all runs, tracked in content/ledger.json. */
export function budgetCap(): number {
  const value = Number(process.env.GEN_MAX_USD ?? '30');
  return Number.isFinite(value) && value > 0 ? value : 30;
}
