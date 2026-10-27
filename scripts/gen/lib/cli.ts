// Small helpers shared by the generation scripts.
export function parseOnly(value: string | undefined): Set<string> | null {
  if (!value) return null;
  return new Set(value.split(',').map((s) => s.trim()).filter(Boolean));
}

export function table(rows: (string | number)[][]): string {
  const widths = rows[0]!.map((_, c) => Math.max(...rows.map((r) => String(r[c] ?? '').length)));
  return rows.map((r) => r.map((cell, c) => String(cell ?? '').padEnd(widths[c]!)).join('  ')).join('\n');
}

export const usd = (n: number) => `$${n.toFixed(2)}`;

export function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}
