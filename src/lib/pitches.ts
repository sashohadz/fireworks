// Mock pitch scripts for pitch mode. One YAML file per pitch in content/pitches, validated with zod.
// Read with fs at build time (and by scripts/validate-content.ts), so both run from the project root.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { products } from './catalog';

const step = z.object({
  title: z.string().min(3).max(60),
  /** Page to show for this step. Steps without a path happen outside the site, e.g. in Business Portal. */
  path: z.string().startsWith('/').optional(),
  minutes: z.number().positive().max(30),
  show: z.array(z.string().min(3)).min(1),
  say: z.array(z.string().min(3)).min(1),
  ask: z.string().min(3).optional(),
});

const pitch = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  order: z.number().int().default(99),
  title: z.string().min(3).max(60),
  audience: z.string().min(3),
  length: z.string().min(3),
  goal: z.string().min(3),
  before: z.array(z.string().min(3)).default([]),
  discovery: z.array(z.string().min(3)).default([]),
  steps: z.array(step).min(2),
});

export type Pitch = z.infer<typeof pitch>;
export type PitchStep = z.infer<typeof step>;

export const PITCHES_DIR = path.join(process.cwd(), 'content', 'pitches');

const handles = new Set(products.map((p) => p.handle));

/** Problems that zod cannot see: duplicate IDs and links to product pages that do not exist. */
function crossCheck(p: Pitch, file: string): string[] {
  const errors: string[] = [];
  if (path.basename(file, '.yaml') !== p.id) errors.push(`${file}: id "${p.id}" must match the file name`);
  p.steps.forEach((s, i) => {
    const handle = s.path?.match(/^\/products\/([^/?#]+)/)?.[1];
    if (handle && !handles.has(handle)) errors.push(`${file}: step ${i + 1} links to unknown product "${handle}"`);
  });
  return errors;
}

export function loadPitches(): { pitches: Pitch[]; errors: string[] } {
  const errors: string[] = [];
  const pitches: Pitch[] = [];
  const files = fs.existsSync(PITCHES_DIR) ? fs.readdirSync(PITCHES_DIR).filter((f) => f.endsWith('.yaml')) : [];
  for (const file of files.sort()) {
    const result = pitch.safeParse(parse(fs.readFileSync(path.join(PITCHES_DIR, file), 'utf8')));
    if (!result.success) {
      errors.push(`${file}: ${result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
      continue;
    }
    errors.push(...crossCheck(result.data, file));
    pitches.push(result.data);
  }
  const ids = pitches.map((p) => p.id);
  ids.filter((id, i) => ids.indexOf(id) !== i).forEach((id) => errors.push(`duplicate pitch id "${id}"`));
  pitches.sort((a, b) => a.order - b.order);
  return { pitches, errors };
}

let cached: Pitch[] | undefined;

/** Pitches for the site build. Invalid files fail the build with a readable message. */
export function getPitches(): Pitch[] {
  if (cached) return cached;
  const { pitches, errors } = loadPitches();
  if (errors.length) throw new Error(`Invalid pitch files:\n${errors.join('\n')}`);
  cached = pitches;
  return pitches;
}

/** The small subset every page needs for the pitch controls. Talking points stay out of the shared tab. */
export function pitchOutline(pitches: Pitch[]) {
  return pitches.map((p) => ({ id: p.id, title: p.title, steps: p.steps.map((s) => ({ title: s.title, path: s.path })) }));
}
