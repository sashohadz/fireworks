// Prompt builders. The brand look lives in content/brand.json (visualStyle) so every asset matches.
import { brand, type Product } from '../../../src/lib/catalog';
import type { ClipScene } from './specs';

const KEEP_PRODUCT = 'Keep the product exactly as in the reference image: same packaging shape, colours, cap and label text.';
const SAFETY = 'No people or faces, no extra text, no other brands.';

export function packshotPrompt(p: Product): string {
  return `${brand.visualStyle} Studio packshot of ${p.imagePrompt}. Centred on a seamless warm off-white background with a soft natural shadow. Square composition, the product fills about 60% of the frame. ${SAFETY}`;
}

const DEFAULT_LIFESTYLE = [
  'standing on pale birch wood beside sea-smoothed pebbles, soft morning window light',
  'on wet dark slate with a few water droplets, misty fjord-blue background, crisp side light',
];

export function lifestylePrompt(p: Product, index: 0 | 1): string {
  const scene = p.lifestylePrompts?.[index] ?? DEFAULT_LIFESTYLE[index];
  return `${KEEP_PRODUCT} Show it ${scene}. ${brand.visualStyle} Vertical 4:5 composition. ${SAFETY}`;
}

export function shadePrompt(p: Product, shade: string, hex: string): string {
  return `${KEEP_PRODUCT} Change only the colour of the ${p.shortName} body to the shade "${shade}" (${hex}). Same background, light and framing. ${SAFETY}`;
}

export function keyframePrompt(scene: ClipScene): string {
  return `${KEEP_PRODUCT} ${scene.keyframe} ${brand.visualStyle} Vertical 9:16 composition with the product in the middle third, leaving calm space at the top and bottom for captions. ${SAFETY}`;
}

export function motionPrompt(scene: ClipScene): string {
  return `${scene.motion} Smooth, slow, cinematic camera movement. The product and its label stay unchanged and in focus. No text, no faces.`;
}
