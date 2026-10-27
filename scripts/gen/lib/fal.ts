// Thin wrapper around the fal.ai client. The key comes from .env (FAL_KEY) and never leaves this machine.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fal } from '@fal-ai/client';
import { requireEnv } from './env';

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  fal.config({ credentials: requireEnv('FAL_KEY') });
  configured = true;
}

export async function falRun<T>(endpoint: string, input: Record<string, unknown>): Promise<{ data: T; requestId: string }> {
  ensureConfigured();
  const started = Date.now();
  // Endpoint IDs are plain strings here, so the client's per-endpoint typing does not apply.
  const result = (await fal.subscribe(endpoint as never, { input: input as never, logs: false })) as unknown as {
    data: T;
    requestId: string;
  };
  console.log(`    fal ${endpoint} done in ${((Date.now() - started) / 1000).toFixed(0)} s (request ${result.requestId})`);
  return result;
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };

/** Uploads a local file to fal storage so a model can read it. Returns a temporary URL. */
export async function falUpload(file: string): Promise<string> {
  ensureConfigured();
  const bytes = await fs.readFile(file);
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  return fal.storage.upload(new Blob([bytes], { type }));
}

export async function download(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await response.arrayBuffer()));
}
