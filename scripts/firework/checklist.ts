// Writes out/upload-checklist.md: everything to do in Business Portal for the generated content,
// in order. Manual upload and tagging is deliberate at first; an API script replaces it later.
//
// Usage: SITE_URL=https://your-site.netlify.app npm run fw:checklist
import fs from 'node:fs';
import path from 'node:path';
import { getProduct, products } from '../../src/lib/catalog';
import { playlistSlots } from '../../src/site.config';
import { posterFile, subtitleFile, videoFile } from '../gen/lib/assets';
import { HORIZONTAL_SOURCES, horizontalPosterFile, horizontalSubtitleFile, horizontalVideoFile } from '../gen/lib/horizontal';
import { fail } from '../gen/lib/cli';
import { OUT } from '../gen/lib/paths';
import { allHashtags, loadSpecs, type AnySpec } from '../gen/lib/specs';

const site = (process.env.SITE_URL ?? '').replace(/\/$/, '') || '<your Netlify site URL>';
const playlistName: Record<string, string> = {
  hero: 'Fjordbloom · Live (Hero unit)',
  storyblock: 'Fjordbloom · Morning ritual (Storyblock)',
  carousel: 'Fjordbloom · Watch and shop (Carousel)',
  grid: 'Fjordbloom · Shop by video (Grid)',
  deck: 'Fjordbloom · Product pages (Player Deck)',
  floating: 'Fjordbloom · Floating player',
  live: 'Fjordbloom · Live replays',
  showroom: 'Fjordbloom · Showroom (restream)',
  horizontal: 'Fjordbloom · Horizontal (16:9)',
  howto: 'Fjordbloom · How-to',
};

const { videos, liveShows, errors } = loadSpecs();
if (errors.length) fail(`Fix the video specs first:\n${errors.join('\n')}`);
const all: AnySpec[] = [...videos, ...liveShows];
const rel = (f: string) => path.relative(process.cwd(), f);
const status = (f: string) => (fs.existsSync(f) ? '' : ' (not rendered yet)');
const unitCount = products.reduce((n, p) => n + p.units.length, 0);

const lines: string[] = [];
lines.push(`# Firework upload checklist`, '', `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} for ${site}.`, '');
lines.push(`## 1. Import the products`, '');
lines.push(`- [ ] Business Portal: Products, then **Import via Google XML**. Feed URL: \`${site}/feeds/google.xml\``);
lines.push(`- [ ] Turn on **Enable Auto-Sync** (every 6 hours is plenty) and add your email for import errors.`);
lines.push(`- [ ] Check the result: ${products.length} products and ${unitCount} units, with external IDs \`FJB-101\` to \`FJB-112\` and unit IDs such as \`FJB-103-30ML\`.`);
lines.push(`- Alternative for practice: the CSV batch import with \`${site}/feeds/firework-products.csv\` (same IDs, so no duplicates).`, '');

lines.push(`## 2. Create the playlists`, '', '| Slot | Suggested name | Videos |', '|---|---|---|');
for (const { slot, usedOn } of playlistSlots) {
  const ids = slot === 'horizontal' ? HORIZONTAL_SOURCES.map((id) => `${id} (16:9)`) : all.filter((s) => s.playlists.includes(slot)).map((s) => s.id);
  lines.push(`| ${slot} (${usedOn}) | ${playlistName[slot]} | ${ids.length ? ids.join(', ') : 'none yet'} |`);
}
lines.push('');

lines.push(`## 3. Upload and tag the videos`, '', 'Press Enter after each hashtag, or Business Portal drops it.', '');
for (const spec of videos) {
  lines.push(`### ${spec.id}`, '');
  lines.push(`- [ ] File: \`${rel(videoFile(spec.id))}\`${status(videoFile(spec.id))}`);
  lines.push(`- Poster: \`${rel(posterFile(spec.id))}\` · Subtitles: \`${rel(subtitleFile(spec.id))}\``);
  lines.push(`- Caption: ${spec.title}`);
  lines.push(`- Description: ${spec.description}`);
  lines.push(`- Hashtags: ${allHashtags(spec).map((h) => `#${h}`).join(' ')}`);
  lines.push(`- Tag products: ${spec.products.map((id) => `${id} ${getProduct(id)!.name}`).join('; ')}`);
  lines.push(`- Playlists: ${spec.playlists.map((s) => playlistName[s]).join('; ') || 'none'}`);
  lines.push(`- Mark it as AI-generated if Business Portal offers the option.`, '');
}

lines.push(`## 4. Schedule the livestream`, '');
for (const show of liveShows) {
  lines.push(`- [ ] Create a livestream event and choose **stream a prerecorded video** with \`${rel(videoFile(show.id))}\`${status(videoFile(show.id))}. Auto start, a few minutes from now.`);
  lines.push(`- [ ] Title: ${show.title}. Pin products: ${show.products.join(', ')}.`);
  lines.push(`- [ ] Add the event to: ${show.playlists.map((s) => playlistName[s]).join('; ')}. The replay appears there afterwards.`);
}
lines.push('');

lines.push(`## 5. Wire up the site`, '');
lines.push('- [ ] Test first without code: open the site, click the gear icon, and enter the channel name and playlist IDs.');
lines.push('- [ ] Then copy them into `src/site.config.ts`, commit, and let Netlify deploy.');
lines.push('- [ ] Check each page with `?debug` and confirm `fw:*` events appear. Product pages should show the right videos through `skus`.');

lines.push('', `## 6. Horizontal videos (16:9)`, '');
lines.push('For the Horizontal Carousel and Horizontal Player examples in the lab. Render them with `npm run gen:horizontal`.', '');
for (const id of HORIZONTAL_SOURCES) {
  const spec = videos.find((v) => v.id === id);
  if (!spec) continue;
  lines.push(`### ${id} (16:9)`, '');
  lines.push(`- [ ] File: \`${rel(horizontalVideoFile(id))}\`${status(horizontalVideoFile(id))}`);
  lines.push(`- Poster: \`${rel(horizontalPosterFile(id))}\` · Subtitles: \`${rel(horizontalSubtitleFile(id))}\``);
  lines.push(`- Caption: ${spec.title} (16:9)`);
  lines.push(`- Tag products: ${spec.products.map((pid) => `${pid} ${getProduct(pid)!.name}`).join('; ')}`);
  lines.push(`- Playlist: ${playlistName.horizontal}`, '');
}
lines.push('- [ ] Send the playlist ID, or set it as `horizontal` in `src/site.config.ts`.');

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, 'upload-checklist.md');
fs.writeFileSync(file, `${lines.join('\n')}\n`);
console.log(`Checklist written to ${rel(file)}`);
