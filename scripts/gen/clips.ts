// AI video clips with fal.ai. For each clip scene: edit the product image into a 9:16 keyframe
// (Nano Banana), then animate it (MiniMax H3 Max by default, Kling for specs that ask for it).
//
// Usage:
//   npm run gen:clips                                   dry run with cost estimate
//   npm run gen:clips -- --run                          generate every missing clip
//   npm run gen:clips -- --run --only fjb-01-cloudberry-serum
//   npm run gen:clips -- --run --model kling            override the model for this run
//   npm run gen:clips -- --run --allow-placeholders     use illustrated images as reference
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { productImageDir, getProduct } from '../../src/lib/catalog';
import { clipFile, clipModel, keyframeFile, productImageFile } from './lib/assets';
import { fail, parseOnly, table, usd } from './lib/cli';
import { budgetCap, loadEnv } from './lib/env';
import { download, falRun, falUpload } from './lib/fal';
import { Budget, recordSpend } from './lib/ledger';
import { MODELS, clipRequest, type VideoModel } from './lib/models';
import { IMAGE_SOURCES_FILE } from './lib/paths';
import { keyframePrompt, motionPrompt } from './lib/prompts';
import { loadSpecs, type ClipScene, type VideoSpec } from './lib/specs';

const { values: args } = parseArgs({
  options: {
    run: { type: 'boolean', default: false },
    only: { type: 'string' },
    model: { type: 'string' },
    'allow-placeholders': { type: 'boolean', default: false },
    'max-usd': { type: 'string' },
  },
});

interface Job {
  spec: VideoSpec;
  index: number;
  scene: ClipScene;
  model: VideoModel;
  keyframe: string;
  clip: string;
  needsKeyframe: boolean;
  usd: number;
}

function planJobs(): Job[] {
  const { videos, errors } = loadSpecs();
  if (errors.length) fail(`Fix the video specs first:\n${errors.join('\n')}`);
  const only = parseOnly(args.only);
  const override = args.model as VideoModel | undefined;
  if (override && override !== 'minimax' && override !== 'kling') fail('--model must be minimax or kling');
  const jobs: Job[] = [];
  for (const spec of videos.filter((v) => !only || only.has(v.id))) {
    spec.scenes.forEach((scene, index) => {
      if (scene.type !== 'clip') return;
      const s = override ? { ...scene, model: override } : scene;
      const clip = clipFile(spec, index, s);
      if (fs.existsSync(clip)) return;
      const keyframe = keyframeFile(spec, index, s);
      const needsKeyframe = !fs.existsSync(keyframe);
      const model = clipModel(spec, s);
      const estimate = clipRequest(model, '', '', s.seconds).usd + (needsKeyframe ? MODELS.imageEdit.usdPerImage : 0);
      jobs.push({ spec, index, scene: s, model, keyframe, clip, needsKeyframe, usd: estimate });
    });
  }
  return jobs;
}

function isAiImage(productId: string, image: string): boolean {
  const sources = fs.existsSync(IMAGE_SOURCES_FILE) ? (JSON.parse(fs.readFileSync(IMAGE_SOURCES_FILE, 'utf8')) as Record<string, unknown>) : {};
  return Boolean(sources[`${productImageDir(getProduct(productId)!)}/${image}.jpg`]);
}

async function main() {
  loadEnv();
  const jobs = planJobs();
  const total = jobs.reduce((n, j) => n + j.usd, 0);
  const budget = new Budget(args['max-usd'] ? Number(args['max-usd']) : budgetCap());
  console.log(
    table([
      ['video', 'scene', 'model', 'seconds', 'keyframe', 'est.'],
      ...jobs.map((j) => [j.spec.id, j.index, j.model, j.scene.seconds, j.needsKeyframe ? 'new' : 'cached', usd(j.usd)]),
    ]),
  );
  console.log(`\n${jobs.length} clips to generate, estimated ${usd(total)}. Spent so far ${usd(budget.spent)} of a ${usd(budget.cap)} cap.`);
  const placeholders = jobs.filter((j) => !isAiImage(j.scene.product, j.scene.image));
  if (placeholders.length) {
    console.log(`Note: ${placeholders.length} clips would start from illustrated placeholder images. Run gen:images first for realistic results, or pass --allow-placeholders.`);
  }
  if (!args.run) {
    console.log('Dry run only. Add --run to generate (needs FAL_KEY in .env).');
    return;
  }
  if (placeholders.length && !args['allow-placeholders']) fail('Some reference images are placeholders. Run npm run gen:images -- --run first, or pass --allow-placeholders.');

  for (const job of jobs) {
    console.log(`→ ${job.spec.id} scene ${job.index} (${job.model}, ${job.scene.seconds}s)`);
    if (job.needsKeyframe) {
      budget.assertCanSpend(MODELS.imageEdit.usdPerImage, `${job.spec.id} keyframe ${job.index}`);
      const reference = await falUpload(productImageFile(job.scene.product, job.scene.image));
      const { data } = await falRun<{ images: { url: string }[] }>(MODELS.imageEdit.endpoint, {
        prompt: keyframePrompt(job.scene),
        image_urls: [reference],
        aspect_ratio: '9:16',
        output_format: 'png',
        num_images: 1,
      });
      const raw = `${job.keyframe}.png`;
      await download(data.images[0]!.url, raw);
      await sharp(raw).resize(1080, 1920, { fit: 'cover' }).jpeg({ quality: 92 }).toFile(job.keyframe);
      fs.rmSync(raw);
      recordSpend({ kind: 'image', model: MODELS.imageEdit.endpoint, ref: path.relative(process.cwd(), job.keyframe), units: 1, unit: 'image', usd: MODELS.imageEdit.usdPerImage });
    }
    const request = clipRequest(job.model, motionPrompt(job.scene), await falUpload(job.keyframe), job.scene.seconds);
    budget.assertCanSpend(request.usd, `${job.spec.id} clip ${job.index}`);
    const { data } = await falRun<{ video: { url: string } }>(request.endpoint, request.input);
    await download(data.video.url, job.clip);
    recordSpend({ kind: 'video', model: request.endpoint, ref: path.relative(process.cwd(), job.clip), units: request.billedSeconds, unit: 'second', usd: request.usd });
  }
  console.log(`\nDone. Total spent ${usd(budget.spent)}. Next: npm run gen:compose`);
}

main().catch((e: Error) => fail(e.message));
