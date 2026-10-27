// AI product images with fal.ai (Nano Banana): a packshot per product, two lifestyle shots that
// reuse the packshot as reference, and optional shade images. Overwrites the placeholders in public/.
//
// Usage:
//   npm run gen:images                          dry run: shows what would be generated and the cost
//   npm run gen:images -- --run                 generate everything that is still a placeholder
//   npm run gen:images -- --run --only FJB-103  one product
//   npm run gen:images -- --run --units         also shade images for multi-shade products
//   npm run gen:images -- --run --force         regenerate even AI images
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { productImageDir, products, type Product } from '../../src/lib/catalog';
import { fail, parseOnly, table, usd } from './lib/cli';
import { budgetCap, loadEnv } from './lib/env';
import { download, falRun, falUpload } from './lib/fal';
import { Budget, recordSpend } from './lib/ledger';
import { MODELS } from './lib/models';
import { IMAGE_SOURCES_FILE, PUBLIC, dirs } from './lib/paths';
import { lifestylePrompt, packshotPrompt, shadePrompt } from './lib/prompts';

const { values: args } = parseArgs({
  options: {
    run: { type: 'boolean', default: false },
    only: { type: 'string' },
    units: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    'max-usd': { type: 'string' },
  },
});

type Sources = Record<string, { source: 'ai'; model: string; prompt: string; at: string }>;
const readSources = (): Sources => (fs.existsSync(IMAGE_SOURCES_FILE) ? JSON.parse(fs.readFileSync(IMAGE_SOURCES_FILE, 'utf8')) : {});
function writeSource(publicPath: string, model: string, prompt: string) {
  const sources = readSources();
  sources[publicPath] = { source: 'ai', model, prompt, at: new Date().toISOString() };
  fs.writeFileSync(IMAGE_SOURCES_FILE, `${JSON.stringify(sources, null, 2)}\n`);
}

interface Job {
  product: Product;
  name: string;
  publicPath: string;
  kind: 'packshot' | 'edit';
  prompt: string;
  aspect: '1:1' | '4:5';
  size: [number, number];
}

function planJobs(): Job[] {
  const only = parseOnly(args.only);
  const sources = readSources();
  const jobs: Job[] = [];
  for (const p of products) {
    if (only && !only.has(p.id) && !only.has(p.handle)) continue;
    const dir = productImageDir(p);
    const want = (name: string) => args.force || !sources[`${dir}/${name}.jpg`];
    if (want('packshot')) jobs.push({ product: p, name: 'packshot', publicPath: `${dir}/packshot.jpg`, kind: 'packshot', prompt: packshotPrompt(p), aspect: '1:1', size: [1200, 1200] });
    ([0, 1] as const).forEach((i) => {
      const name = `lifestyle-${i + 1}`;
      if (want(name)) jobs.push({ product: p, name, publicPath: `${dir}/${name}.jpg`, kind: 'edit', prompt: lifestylePrompt(p, i), aspect: '4:5', size: [1200, 1500] });
    });
    if (args.units) {
      for (const u of p.units.filter((x) => x.swatch)) {
        const name = `unit-${u.id}`;
        if (want(name)) jobs.push({ product: p, name, publicPath: `${dir}/${name}.jpg`, kind: 'edit', prompt: shadePrompt(p, u.name, u.swatch!), aspect: '1:1', size: [1200, 1200] });
      }
    }
  }
  return jobs;
}

async function saveImage(url: string, job: Job) {
  const raw = path.join(dirs.rawImages, job.product.handle, `${job.name}.png`);
  await download(url, raw);
  await sharp(raw).resize(job.size[0], job.size[1], { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(PUBLIC, job.publicPath));
}

async function main() {
  loadEnv();
  const jobs = planJobs();
  const cost = jobs.length * MODELS.image.usdPerImage;
  const budget = new Budget(args['max-usd'] ? Number(args['max-usd']) : budgetCap());
  console.log(table([['product', 'image', 'model', 'est.'], ...jobs.map((j) => [j.product.id, j.name, j.kind === 'packshot' ? 'nano-banana' : 'nano-banana/edit', usd(MODELS.image.usdPerImage)])]));
  console.log(`\n${jobs.length} images, estimated ${usd(cost)}. Spent so far ${usd(budget.spent)} of a ${usd(budget.cap)} cap.`);
  if (!args.run) {
    console.log('Dry run only. Add --run to generate (needs FAL_KEY in .env).');
    return;
  }
  for (const job of jobs) {
    budget.assertCanSpend(MODELS.image.usdPerImage, `${job.product.id} ${job.name}`);
    console.log(`→ ${job.product.id} ${job.name}`);
    let url: string;
    if (job.kind === 'packshot') {
      const { data } = await falRun<{ images: { url: string }[] }>(MODELS.image.endpoint, { prompt: job.prompt, aspect_ratio: job.aspect, output_format: 'png', num_images: 1 });
      url = data.images[0]!.url;
    } else {
      const packshot = path.join(PUBLIC, productImageDir(job.product), 'packshot.jpg');
      if (!readSources()[`${productImageDir(job.product)}/packshot.jpg`]) {
        console.log(`  skipped: the packshot for ${job.product.id} is still a placeholder. Generate it first.`);
        continue;
      }
      const reference = await falUpload(packshot);
      const { data } = await falRun<{ images: { url: string }[] }>(MODELS.imageEdit.endpoint, { prompt: job.prompt, image_urls: [reference], aspect_ratio: job.aspect, output_format: 'png', num_images: 1 });
      url = data.images[0]!.url;
    }
    await saveImage(url, job);
    recordSpend({ kind: 'image', model: job.kind === 'packshot' ? MODELS.image.endpoint : MODELS.imageEdit.endpoint, ref: job.publicPath, units: 1, unit: 'image', usd: MODELS.image.usdPerImage });
    writeSource(job.publicPath, job.kind === 'packshot' ? MODELS.image.endpoint : MODELS.imageEdit.endpoint, job.prompt);
  }
  console.log(`\nDone. Total spent ${usd(budget.spent)}. Review the images, then commit public/images and content/.`);
}

main().catch((e: Error) => fail(e.message));
