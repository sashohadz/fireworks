import path from 'node:path';

export const ROOT = process.cwd();
export const PUBLIC = path.join(ROOT, 'public');
export const OUT = path.join(ROOT, 'out');

/** Everything under out/ is gitignored: raw AI outputs, clips, audio and rendered videos. */
export const dirs = {
  rawImages: path.join(OUT, 'images'),
  keyframes: path.join(OUT, 'keyframes'),
  clips: path.join(OUT, 'clips'),
  voice: path.join(OUT, 'voice'),
  cards: path.join(OUT, 'cards'),
  videos: path.join(OUT, 'videos'),
};

export const SPECS_DIR = path.join(ROOT, 'content', 'videos');
export const LEDGER_FILE = path.join(ROOT, 'content', 'ledger.json');
export const IMAGE_SOURCES_FILE = path.join(ROOT, 'content', 'catalog', 'image-sources.json');
export const MANIFEST_FILE = path.join(ROOT, 'content', 'firework-manifest.json');
