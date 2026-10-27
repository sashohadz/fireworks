// Renders the final 1080x1920 MP4 for each video spec from clips, cards, captions and voice-over.
// Free: it only uses local files. Scenes without an AI clip fall back to slow zoom over the product image.
//
// Usage:
//   npm run gen:compose                              all videos
//   npm run gen:compose -- --only fjb-01-cloudberry-serum
//   npm run gen:compose -- --fallback                ignore AI clips, use stills everywhere
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { defaultUnit, formatPrice, getProduct, unitImage } from '../../src/lib/catalog';
import { clipFile, fileHash, posterFile, productImageFile, shortHash, subtitleFile, videoFile, voiceFile } from './lib/assets';
import { fail, parseOnly, table } from './lib/cli';
import { ffmpeg, mediaDuration, verifyVideo } from './lib/ffmpeg';
import { Renderer, captionHtml, chromeHtml, imageDataUri, priceCardHtml, stillFrameHtml, titleCardHtml } from './lib/graphics';
import { PUBLIC, dirs } from './lib/paths';
import { loadSpecs, type VideoSpec } from './lib/specs';
import { TRANSITION, renderTimeline, segmentStarts, toVtt, type Segment, type TimedOverlay, type VoiceClip } from './lib/timeline';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    fallback: { type: 'boolean', default: false },
    locale: { type: 'string', default: 'en' },
  },
});

async function renderOnce(renderer: Renderer, html: string, file: string, opts: { transparent?: boolean; type?: 'png' | 'jpeg' } = {}) {
  if (!fs.existsSync(file)) await renderer.render(html, file, opts);
  return file;
}

/** Splits voice-over text into sentence cues spread over the spoken duration. */
function voiceCues(text: string, start: number, duration: number) {
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const total = sentences.reduce((n, s) => n + s.length, 0);
  let t = start;
  return sentences.map((s) => {
    const d = (s.length / total) * duration;
    const cue = { start: t, end: t + d, text: s };
    t += d;
    return cue;
  });
}

async function composeVideo(spec: VideoSpec, renderer: Renderer, locale: string, forceFallback: boolean) {
  const cards = path.join(dirs.cards, spec.id);
  const segments: Segment[] = [];
  const captionScenes: { index: number; text: string; seconds: number }[] = [];
  let aiClips = 0;
  let stills = 0;

  for (const [i, scene] of spec.scenes.entries()) {
    if (scene.type === 'clip') {
      const clip = clipFile(spec, i, scene);
      if (!forceFallback && fs.existsSync(clip)) {
        segments.push({ kind: 'video', file: clip, seconds: scene.seconds });
        aiClips++;
      } else {
        const source = productImageFile(scene.product, scene.image);
        const frame = path.join(cards, `${i}-still-${fileHash(source)}.jpg`);
        await renderOnce(renderer, stillFrameHtml(imageDataUri(source)), frame, { type: 'jpeg' });
        segments.push({ kind: 'kenburns', file: frame, seconds: scene.seconds });
        stills++;
      }
      if (scene.caption) captionScenes.push({ index: i, text: scene.caption, seconds: scene.seconds });
    } else if (scene.type === 'title') {
      const file = path.join(cards, `${i}-title-${shortHash(scene)}.png`);
      await renderOnce(renderer, titleCardHtml({ text: scene.text, subtext: scene.subtext }), file);
      segments.push({ kind: 'still', file, seconds: scene.seconds });
    } else {
      const product = getProduct(scene.product)!;
      const unit = product.units.find((u) => u.id === scene.unit) ?? defaultUnit(product);
      const image = path.join(PUBLIC, unitImage(product, unit));
      const file = path.join(cards, `${i}-price-${shortHash({ scene, unit, img: fileHash(image) })}.png`);
      await renderOnce(
        renderer,
        priceCardHtml({
          name: product.shortName,
          unitName: product.units.length > 1 ? unit.name : undefined,
          price: formatPrice(unit.price),
          compare: unit.compareAtPrice ? formatPrice(unit.compareAtPrice) : undefined,
          cta: scene.cta,
          image: imageDataUri(image),
        }),
        file,
      );
      segments.push({ kind: 'still', file, seconds: scene.seconds });
    }
  }

  const starts = segmentStarts(segments);
  const captions: TimedOverlay[] = [];
  for (const c of captionScenes) {
    const file = path.join(cards, `caption-${shortHash(c.text)}.png`);
    await renderOnce(renderer, captionHtml(c.text), file, { transparent: true });
    captions.push({ file, start: starts[c.index]! + 0.25, end: starts[c.index]! + c.seconds - TRANSITION - 0.05 });
  }

  const label = aiClips > 0 ? 'AI-generated demo' : 'Illustrated demo';
  const chrome = await renderOnce(renderer, chromeHtml(label), path.join(dirs.cards, `chrome-${shortHash(label)}.png`), { transparent: true });

  const voices: VoiceClip[] = [];
  let voiceNote = 'none in spec';
  let cues = captionScenes.map((c, k) => ({ start: captions[k]!.start, end: captions[k]!.end, text: c.text }));
  const text = spec.voiceover?.[locale];
  if (text) {
    const vf = voiceFile(spec.id, 'vo', locale, text, spec.voice);
    if (fs.existsSync(vf)) {
      voices.push({ file: vf, start: 0.4 });
      voiceNote = 'yes';
      cues = voiceCues(text, 0.4, await mediaDuration(vf));
    } else {
      voiceNote = 'missing (run gen:voice)';
    }
  }

  const out = videoFile(spec.id, locale);
  await fs.promises.mkdir(path.dirname(out), { recursive: true });
  const duration = await renderTimeline({ segments, chrome, captions, voices, out });
  await ffmpeg(['-ss', '1.2', '-i', out, '-frames:v', '1', '-q:v', '3', posterFile(spec.id, locale)]);
  await fs.promises.writeFile(subtitleFile(spec.id, locale), toVtt(cues));
  const { problems } = await verifyVideo(out);
  return { id: spec.id, duration, aiClips, stills, voiceNote, problems, out };
}

async function main() {
  const { videos, errors } = loadSpecs();
  if (errors.length) fail(`Fix the video specs first:\n${errors.join('\n')}`);
  const only = parseOnly(args.only);
  const selected = videos.filter((v) => !only || only.has(v.id));
  if (selected.length === 0) fail('No matching video specs.');

  const renderer = await Renderer.open();
  const results = [];
  try {
    for (const spec of selected) {
      process.stdout.write(`Composing ${spec.id}… `);
      const r = await composeVideo(spec, renderer, args.locale!, args.fallback!);
      console.log(r.problems.length ? `done with problems: ${r.problems.join('; ')}` : 'done');
      results.push(r);
    }
  } finally {
    await renderer.close();
  }
  console.log(
    `\n${table([
      ['video', 'seconds', 'AI clips', 'stills', 'voice-over', 'checks'],
      ...results.map((r) => [r.id, r.duration.toFixed(1), r.aiClips, r.stills, r.voiceNote, r.problems.length ? 'FAILED' : 'ok']),
    ])}`,
  );
  console.log(`\nVideos, posters and subtitles are in ${path.relative(process.cwd(), dirs.videos)}/`);
  if (results.some((r) => r.problems.length)) process.exit(1);
}

await main();
