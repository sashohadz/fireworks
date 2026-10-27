// Deterministic file names for generated assets. Each name contains a hash of everything that
// produced it (prompt, model, source image), so reruns reuse existing files and a changed prompt
// creates a new file instead of silently reusing an old one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getProduct, productImageDir } from '../../../src/lib/catalog';
import { MODELS, type VideoModel } from './models';
import { PUBLIC, dirs } from './paths';
import type { ClipScene, VideoSpec } from './specs';

export const shortHash = (value: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 10);

export function fileHash(file: string): string {
  if (!fs.existsSync(file)) return 'missing';
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
}

export function productImageFile(productId: string, image: 'packshot' | 'lifestyle-1' | 'lifestyle-2' = 'packshot'): string {
  const product = getProduct(productId);
  if (!product) throw new Error(`Unknown product ${productId}`);
  return path.join(PUBLIC, productImageDir(product), `${image}.jpg`);
}

export const clipModel = (spec: VideoSpec, scene: ClipScene): VideoModel => scene.model ?? spec.model;

export function keyframeFile(spec: VideoSpec, index: number, scene: ClipScene): string {
  const h = shortHash({ m: MODELS.imageEdit.endpoint, k: scene.keyframe, src: fileHash(productImageFile(scene.product, scene.image)) });
  return path.join(dirs.keyframes, spec.id, `${index}-${h}.jpg`);
}

export function clipFile(spec: VideoSpec, index: number, scene: ClipScene): string {
  const h = shortHash({ m: clipModel(spec, scene), motion: scene.motion, s: scene.seconds, kf: path.basename(keyframeFile(spec, index, scene)) });
  return path.join(dirs.clips, spec.id, `${index}-${h}.mp4`);
}

export function voiceFile(id: string, key: string, locale: string, text: string, voice: string): string {
  return path.join(dirs.voice, id, `${key}.${locale}-${shortHash({ text, voice, m: MODELS.tts.endpoint })}.mp3`);
}

export const videoFile = (id: string, locale = 'en') => path.join(dirs.videos, `${id}.${locale}.mp4`);
export const posterFile = (id: string, locale = 'en') => path.join(dirs.videos, `${id}.${locale}.jpg`);
export const subtitleFile = (id: string, locale = 'en') => path.join(dirs.videos, `${id}.${locale}.vtt`);
