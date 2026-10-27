// Voice-over with fal.ai (ElevenLabs Turbo v2.5): short-video voice-overs and live-show host lines.
//
// Usage:
//   npm run gen:voice                       dry run with cost estimate
//   npm run gen:voice -- --run              generate every missing line
//   npm run gen:voice -- --run --locale de  German voice-overs, where specs have them
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { voiceFile } from './lib/assets';
import { fail, parseOnly, table, usd } from './lib/cli';
import { budgetCap, loadEnv } from './lib/env';
import { download, falRun } from './lib/fal';
import { Budget, recordSpend } from './lib/ledger';
import { MODELS, ttsCost } from './lib/models';
import { loadSpecs } from './lib/specs';

const { values: args } = parseArgs({
  options: {
    run: { type: 'boolean', default: false },
    only: { type: 'string' },
    locale: { type: 'string', default: 'en' },
    'max-usd': { type: 'string' },
  },
});

interface Line {
  id: string;
  key: string;
  text: string;
  voice: string;
  file: string;
}

function planLines(): Line[] {
  const { videos, liveShows, errors } = loadSpecs();
  if (errors.length) fail(`Fix the video specs first:\n${errors.join('\n')}`);
  const only = parseOnly(args.only);
  const locale = args.locale!;
  const lines: Line[] = [];
  const add = (id: string, key: string, text: string, voice: string) => {
    const file = voiceFile(id, key, locale, text, voice);
    if (!fs.existsSync(file)) lines.push({ id, key, text, voice, file });
  };
  for (const v of videos) {
    if (only && !only.has(v.id)) continue;
    const text = v.voiceover?.[locale];
    if (text) add(v.id, 'vo', text, v.voice);
  }
  if (locale === 'en') {
    for (const show of liveShows) {
      if (only && !only.has(show.id)) continue;
      add(show.id, 'intro', show.intro.host, show.voice);
      show.segments.forEach((seg, i) => add(show.id, `seg-${i}`, seg.host, show.voice));
      add(show.id, 'outro', show.outro.host, show.voice);
    }
  }
  return lines;
}

async function main() {
  loadEnv();
  const lines = planLines();
  const total = lines.reduce((n, l) => n + ttsCost(l.text), 0);
  const budget = new Budget(args['max-usd'] ? Number(args['max-usd']) : budgetCap());
  console.log(table([['video', 'line', 'chars', 'est.'], ...lines.map((l) => [l.id, l.key, l.text.length, usd(ttsCost(l.text))])]));
  console.log(`\n${lines.length} lines, estimated ${usd(total)}. Spent so far ${usd(budget.spent)} of a ${usd(budget.cap)} cap.`);
  if (!args.run) {
    console.log('Dry run only. Add --run to generate (needs FAL_KEY in .env).');
    return;
  }
  for (const line of lines) {
    const cost = ttsCost(line.text);
    budget.assertCanSpend(cost, `${line.id} ${line.key}`);
    console.log(`→ ${line.id} ${line.key}`);
    const input: Record<string, unknown> = { text: line.text, voice: line.voice, stability: 0.5, similarity_boost: 0.75, speed: 1 };
    if (args.locale !== 'en') input.language_code = args.locale;
    const { data } = await falRun<{ audio: { url: string } }>(MODELS.tts.endpoint, input);
    await download(data.audio.url, line.file);
    recordSpend({ kind: 'voice', model: MODELS.tts.endpoint, ref: `${line.id}/${line.key}.${args.locale}`, units: line.text.length, unit: 'char', usd: cost });
  }
  console.log(`\nDone. Total spent ${usd(budget.spent)}. Next: npm run gen:compose`);
}

main().catch((e: Error) => fail(e.message));
