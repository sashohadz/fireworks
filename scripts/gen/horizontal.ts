// Makes 1920x1080 versions of a few rendered videos for the horizontal layouts in /lab/layouts.
// Free and local: the vertical video sits in the middle of a blurred, widened copy of itself.
// Same output settings as the other videos: H.264 + AAC, 30 fps, 2-second keyframes, faststart.
//
// Usage: npm run gen:horizontal                 all four
//        npm run gen:horizontal -- --only fjb-09-brand-hero
import fs from 'node:fs';
import { posterFile, subtitleFile, videoFile } from './lib/assets';
import { fail, parseOnly, table } from './lib/cli';
import { ffmpeg, verifyVideo } from './lib/ffmpeg';
import { HORIZONTAL_SOURCES, horizontalPosterFile, horizontalSubtitleFile, horizontalVideoFile } from './lib/horizontal';

const FPS = 30;
const args = process.argv.slice(2);
const only = parseOnly(args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined);
const ids = HORIZONTAL_SOURCES.filter((id) => !only || only.has(id));
if (ids.length === 0) fail(`Nothing to do. Choose from: ${HORIZONTAL_SOURCES.join(', ')}`);

const missing = ids.filter((id) => !fs.existsSync(videoFile(id)));
if (missing.length) fail(`Render these first with npm run gen:compose: ${missing.join(', ')}`);

// Background: the same video, scaled to cover 16:9, blurred and darkened slightly. Foreground: the original, full height.
const filter = [
  '[0:v]split=2[bg][fg]',
  '[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=60,eq=brightness=-0.08:saturation=0.9[bgb]',
  '[fg]scale=-2:1080[fgs]',
  '[bgb][fgs]overlay=(W-w)/2:0,format=yuv420p[v]',
].join(';');

const rows: (string | number)[][] = [['video', 'size', 'seconds', 'check']];
for (const id of ids) {
  const out = horizontalVideoFile(id);
  console.log(`Rendering ${id} at 16:9…`);
  await ffmpeg([
    '-i', videoFile(id),
    '-filter_complex', filter,
    '-map', '[v]', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-g', String(FPS * 2), '-keyint_min', String(FPS * 2), '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', out,
  ]);
  await ffmpeg(['-ss', '1', '-i', out, '-frames:v', '1', '-q:v', '3', horizontalPosterFile(id)]);
  if (fs.existsSync(subtitleFile(id))) fs.copyFileSync(subtitleFile(id), horizontalSubtitleFile(id));
  const { info, problems } = await verifyVideo(out, { width: 1920, height: 1080 });
  rows.push([id, `${info.width}x${info.height}`, info.duration.toFixed(1), problems.length ? problems.join('; ') : 'ok']);
  if (!fs.existsSync(posterFile(id))) console.warn(`  note: no vertical poster for ${id}`);
}
console.log(`\n${table(rows)}\n`);
console.log('Next: npm run fw:checklist, then upload the 16:9 files as described in section 6.');
