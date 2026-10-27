// Video specs: one YAML file per video in content/videos. Validated with zod and cross-checked
// against the catalog, so a typo in a product ID fails before any money is spent.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { getProduct } from '../../../src/lib/catalog';
import { playlistSlots } from '../../../src/site.config';
import { SPECS_DIR } from './paths';

const slots = playlistSlots.map((s) => s.slot) as [string, ...string[]];
const videoModel = z.enum(['minimax', 'kling']);

const clipScene = z.object({
  type: z.literal('clip'),
  /** Product whose image is the reference for the first frame. */
  product: z.string(),
  image: z.enum(['packshot', 'lifestyle-1', 'lifestyle-2']).default('packshot'),
  /** Scene for the 9:16 first frame, made by editing the product image. */
  keyframe: z.string().min(10),
  /** Camera and motion prompt for image-to-video. */
  motion: z.string().min(10),
  seconds: z.number().min(2).max(10).default(5),
  model: videoModel.optional(),
  caption: z.string().max(60).optional(),
});

const titleScene = z.object({
  type: z.literal('title'),
  text: z.string().max(60),
  subtext: z.string().max(90).optional(),
  seconds: z.number().min(1).max(8).default(2.5),
});

const priceScene = z.object({
  type: z.literal('price'),
  product: z.string(),
  unit: z.string().optional(),
  cta: z.string().max(30).default('Tap to shop'),
  seconds: z.number().min(1).max(8).default(3),
});

export const sceneSchema = z.discriminatedUnion('type', [clipScene, titleScene, priceScene]);

const common = {
  id: z.string().regex(/^fjb-\d{2}-[a-z0-9-]+$/),
  /** Firework video caption (title). */
  title: z.string().max(90),
  description: z.string(),
  purpose: z.string(),
  products: z.array(z.string()).min(1),
  hashtags: z.array(z.string().regex(/^[a-z0-9]+$/, 'hashtags are lowercase letters and digits')).default([]),
  playlists: z.array(z.enum(slots)).default([]),
  voice: z.string().default('Aria'),
};

export const videoSpecSchema = z.object({
  ...common,
  kind: z.enum(['short', 'hero', 'routine', 'howto']),
  model: videoModel.default('minimax'),
  /** Voice-over text per locale, e.g. { en: "..." }. */
  voiceover: z.record(z.string(), z.string().max(400)).optional(),
  scenes: z.array(sceneSchema).min(1),
});

const hostLine = z.object({ text: z.string().max(60), subtext: z.string().max(90).optional(), host: z.string().max(500) });

export const liveShowSchema = z.object({
  ...common,
  kind: z.literal('live-show'),
  intro: hostLine,
  segments: z
    .array(
      z.object({
        /** ID of a short video spec whose rendered video is reused here. */
        video: z.string(),
        product: z.string(),
        unit: z.string().optional(),
        host: z.string().max(500),
      }),
    )
    .min(1),
  outro: hostLine,
});

export type ClipScene = z.infer<typeof clipScene>;
export type Scene = z.infer<typeof sceneSchema>;
export type VideoSpec = z.infer<typeof videoSpecSchema>;
export type LiveShowSpec = z.infer<typeof liveShowSchema>;
export type AnySpec = VideoSpec | LiveShowSpec;

export interface LoadedSpecs {
  videos: VideoSpec[];
  liveShows: LiveShowSpec[];
  errors: string[];
}

export function loadSpecs(): LoadedSpecs {
  const videos: VideoSpec[] = [];
  const liveShows: LiveShowSpec[] = [];
  const errors: string[] = [];
  const files = fs.existsSync(SPECS_DIR) ? fs.readdirSync(SPECS_DIR).filter((f) => f.endsWith('.yaml')).sort() : [];

  for (const file of files) {
    const raw = parse(fs.readFileSync(path.join(SPECS_DIR, file), 'utf8')) as { kind?: string };
    const result = raw?.kind === 'live-show' ? liveShowSchema.safeParse(raw) : videoSpecSchema.safeParse(raw);
    if (!result.success) {
      errors.push(`${file}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      continue;
    }
    const spec = result.data;
    if (`${spec.id}.yaml` !== file) errors.push(`${file}: id "${spec.id}" must match the file name`);
    const productRefs = [
      ...spec.products,
      ...('scenes' in spec ? spec.scenes.flatMap((s) => ('product' in s ? [s.product] : [])) : spec.segments.map((s) => s.product)),
    ];
    for (const id of productRefs) if (!getProduct(id)) errors.push(`${file}: unknown product ${id}`);
    if ('scenes' in spec) {
      for (const scene of spec.scenes) {
        if (scene.type === 'price' && scene.unit && !getProduct(scene.product)?.units.some((u) => u.id === scene.unit)) {
          errors.push(`${file}: unit ${scene.unit} does not belong to ${scene.product}`);
        }
      }
      videos.push(spec);
    } else {
      liveShows.push(spec);
    }
  }

  const ids = new Set(videos.map((v) => v.id));
  for (const show of liveShows) {
    for (const seg of show.segments) if (!ids.has(seg.video)) errors.push(`${show.id}: segment video ${seg.video} has no spec`);
  }
  return { videos, liveShows, errors };
}

/** Product hashtags (e.g. fjb103) are always added so the hashtag-filter fallback works. */
export function allHashtags(spec: AnySpec): string[] {
  const productTags = spec.products.map((id) => id.toLowerCase().replace(/-/g, ''));
  return [...new Set(['fjordbloom', ...spec.hashtags, ...productTags])];
}
