// fal.ai endpoints and prices used for cost estimates (checked 27 Oct 2026, https://fal.ai/pricing).
// Estimates use regular prices, so a run never costs more than the dry run says.

export type VideoModel = 'minimax' | 'kling';

export const MODELS = {
  image: { endpoint: 'fal-ai/nano-banana', usdPerImage: 0.0398 },
  imageEdit: { endpoint: 'fal-ai/nano-banana/edit', usdPerImage: 0.0398 },
  minimax: {
    endpoint: 'minimax/h3-max/image-to-video',
    usdPerSecond: 0.08,
    note: '768P. A 35% promo price applies until 31 Oct 2026; estimates use the regular price.',
  },
  kling: {
    endpoint: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    usdPerSecond: 0.07,
    note: 'Only 5 s or 10 s clips. Compose trims them to the scene length.',
  },
  tts: { endpoint: 'fal-ai/elevenlabs/tts/turbo-v2.5', usdPer1kChars: 0.05 },
} as const;

export const NEGATIVE_PROMPT =
  'text, captions, watermark, changed logo, changed label, extra products, distorted packaging, faces, blur, low quality';

export interface ClipRequest {
  endpoint: string;
  input: Record<string, unknown>;
  /** Seconds billed, used for the estimate. */
  billedSeconds: number;
  usd: number;
}

export function clipRequest(model: VideoModel, prompt: string, imageUrl: string, seconds: number): ClipRequest {
  if (model === 'kling') {
    const duration = seconds <= 5 ? 5 : 10;
    return {
      endpoint: MODELS.kling.endpoint,
      input: { prompt, image_url: imageUrl, duration: String(duration), negative_prompt: NEGATIVE_PROMPT, cfg_scale: 0.5 },
      billedSeconds: duration,
      usd: duration * MODELS.kling.usdPerSecond,
    };
  }
  const duration = Math.min(15, Math.max(2, seconds));
  // Output can run up to ~0.7 s longer than requested, so the estimate includes that.
  const billed = duration + 0.7;
  return {
    endpoint: MODELS.minimax.endpoint,
    input: { prompt, image_url: imageUrl, duration, resolution: '768P', prompt_expansion_mode: 'disabled' },
    billedSeconds: billed,
    usd: billed * MODELS.minimax.usdPerSecond,
  };
}

export const ttsCost = (text: string) => (text.length / 1000) * MODELS.tts.usdPer1kChars;
