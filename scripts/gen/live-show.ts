// Builds the 3-5 minute "live shopping" show from the composed shorts, price cards and host voice-over.
// Stream the result as a prerecorded livestream in Business Portal, or play it in OBS as a media source.
//
// Usage: npm run gen:compose && npm run gen:live-show [-- --only fjb-11-live-show]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { defaultUnit, formatPrice, getProduct, unitImage } from '../../src/lib/catalog';
import { fileHash, posterFile, shortHash, subtitleFile, videoFile, voiceFile } from './lib/assets';
import { fail, parseOnly } from './lib/cli';
import { ffmpeg, mediaDuration, verifyVideo } from './lib/ffmpeg';
import { Renderer, imageDataUri, priceCardHtml, titleCardHtml } from './lib/graphics';
import { PUBLIC, dirs } from './lib/paths';
import { loadSpecs, type LiveShowSpec } from './lib/specs';
import { renderTimeline, segmentStarts, toVtt, type Segment, type VoiceClip } from './lib/timeline';

const { values: args } = parseArgs({ options: { only: { type: 'string' } } });
const CARD_SECONDS_WITHOUT_VOICE = 6;

async function build(show: LiveShowSpec, renderer: Renderer) {
  const cards = path.join(dirs.cards, show.id);
  const segments: Segment[] = [];
  const spoken: { segment: number; file: string | null; text: string }[] = [];

  /** voiceKey must match the keys used by gen:voice (intro, seg-N, outro). */
  const hostCard = async (voiceKey: string, html: string, text: string, imageHash = '') => {
    const file = path.join(cards, `${voiceKey}-${shortHash({ text, len: html.length, imageHash })}.png`);
    if (!fs.existsSync(file)) await renderer.render(html, file);
    const vf = voiceFile(show.id, voiceKey, 'en', text, show.voice);
    const hasVoice = fs.existsSync(vf);
    const seconds = hasVoice ? Math.max(5, (await mediaDuration(vf)) + 1.2) : CARD_SECONDS_WITHOUT_VOICE;
    spoken.push({ segment: segments.length, file: hasVoice ? vf : null, text });
    segments.push({ kind: 'still', file, seconds });
  };

  await hostCard('intro', titleCardHtml({ text: show.intro.text, subtext: show.intro.subtext }), show.intro.host);
  for (const [i, seg] of show.segments.entries()) {
    const short = videoFile(seg.video, 'en');
    if (!fs.existsSync(short)) fail(`${seg.video} has not been composed yet. Run: npm run gen:compose`);
    segments.push({ kind: 'video', file: short, seconds: await mediaDuration(short) });
    const product = getProduct(seg.product)!;
    const unit = product.units.find((u) => u.id === seg.unit) ?? defaultUnit(product);
    const image = path.join(PUBLIC, unitImage(product, unit));
    const html = priceCardHtml({
      name: product.shortName,
      unitName: product.units.length > 1 ? unit.name : undefined,
      price: formatPrice(unit.price),
      compare: unit.compareAtPrice ? formatPrice(unit.compareAtPrice) : undefined,
      cta: 'Pinned below: tap to shop',
      image: imageDataUri(image),
    });
    await hostCard(`seg-${i}`, html, seg.host, fileHash(image));
  }
  await hostCard('outro', titleCardHtml({ text: show.outro.text, subtext: show.outro.subtext }), show.outro.host);

  const starts = segmentStarts(segments);
  const voices: VoiceClip[] = [];
  // Each short keeps its own voice-over; host lines play over the cards.
  segments.forEach((s, i) => {
    if (s.kind === 'video') voices.push({ file: s.file, start: starts[i]! });
  });
  const cues: { start: number; end: number; text: string }[] = [];
  for (const line of spoken) {
    const start = starts[line.segment]! + 0.3;
    if (line.file) voices.push({ file: line.file, start });
    cues.push({ start, end: starts[line.segment]! + segments[line.segment]!.seconds - 0.4, text: line.text });
  }

  const out = videoFile(show.id, 'en');
  const duration = await renderTimeline({ segments, captions: [], voices, out });
  await ffmpeg(['-ss', '2', '-i', out, '-frames:v', '1', '-q:v', '3', posterFile(show.id, 'en')]);
  await fs.promises.writeFile(subtitleFile(show.id, 'en'), toVtt(cues));
  const { problems } = await verifyVideo(out);
  const withVoice = spoken.filter((s) => s.file).length;
  console.log(
    `${show.id}: ${(duration / 60).toFixed(1)} min, host voice-over ${withVoice}/${spoken.length} lines` +
      `${withVoice < spoken.length ? ' (run gen:voice for the rest)' : ''}, checks ${problems.length ? `FAILED: ${problems.join('; ')}` : 'ok'}`,
  );
  console.log(`  ${path.relative(process.cwd(), out)}`);
  return problems.length === 0;
}

const { liveShows, errors } = loadSpecs();
if (errors.length) fail(`Fix the video specs first:\n${errors.join('\n')}`);
const only = parseOnly(args.only);
const selected = liveShows.filter((s) => !only || only.has(s.id));
if (selected.length === 0) fail('No matching live-show specs.');

const renderer = await Renderer.open();
let ok = true;
try {
  for (const show of selected) ok = (await build(show, renderer)) && ok;
} finally {
  await renderer.close();
}
if (!ok) process.exit(1);
