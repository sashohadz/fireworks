// Free, offline placeholder images for every product and shade.
// Draws simple branded packaging as SVG and converts it to JPEG with sharp.
// AI-generated images (npm run gen:images) later overwrite the same file names.
//
// Usage: npm run gen:placeholders [-- --force]
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { brand, products, productImageDir, type Product, type Unit } from '../../src/lib/catalog';

const { values: args } = parseArgs({ options: { force: { type: 'boolean', default: false } } });
const PUBLIC = path.join(process.cwd(), 'public');
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ---------- colour helpers ----------
function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex([0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * amount) as [number, number, number]);
}
const lighten = (hex: string, amount: number) => mix(hex, '#FFFFFF', amount);
const darken = (hex: string, amount: number) => mix(hex, '#000000', amount);
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---------- packaging drawings (1200 x 1200 coordinate space) ----------
interface Look {
  body: string;
  cap: string;
  label: string;
  title: string;
  subtitle: string;
}

function gradient(id: string, base: string): string {
  return `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${darken(base, 0.12)}"/>
    <stop offset="0.35" stop-color="${lighten(base, 0.12)}"/>
    <stop offset="0.7" stop-color="${base}"/>
    <stop offset="1" stop-color="${darken(base, 0.18)}"/>
  </linearGradient>`;
}

function labelText(look: Look, cx: number, top: number, width: number): string {
  const titleLines = wrap(look.title, width < 240 ? 9 : 14).slice(0, 3);
  const titleSize = width < 240 ? 24 : 30;
  const brandSize = width < 240 ? 15 : 20;
  let y = top;
  let out = `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${brandSize}" letter-spacing="${brandSize * 0.32}" fill="${look.label}" font-weight="600">FJORDBLOOM</text>`;
  y += titleSize * 1.9;
  for (const line of titleLines) {
    out += `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${titleSize}" fill="${look.label}" font-weight="300">${esc(line)}</text>`;
    y += titleSize * 1.25;
  }
  if (look.subtitle) {
    out += `<text x="${cx}" y="${y + 18}" text-anchor="middle" font-family="${FONT}" font-size="${titleSize * 0.7}" fill="${look.label}" opacity="0.75">${esc(look.subtitle)}</text>`;
  }
  return out;
}

function highlight(x: number, y: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="22" height="${h}" rx="11" fill="#FFFFFF" opacity="0.28"/>`;
}

function drawPackaging(type: Product['packaging']['type'], look: Look): string {
  const defs = `<defs>${gradient('body', look.body)}${gradient('cap', look.cap)}
    <radialGradient id="stone" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="${lighten(look.body, 0.35)}"/><stop offset="1" stop-color="${darken(look.body, 0.12)}"/></radialGradient></defs>`;
  const shadow = `<ellipse cx="600" cy="962" rx="250" ry="24" fill="#14212B" opacity="0.13" filter="url(#blur)"/>`;
  switch (type) {
    case 'dropper':
      return `${defs}${shadow}
        <rect x="572" y="205" width="56" height="175" rx="28" fill="url(#cap)"/>
        <rect x="543" y="360" width="114" height="92" rx="12" fill="url(#cap)"/>
        <rect x="458" y="440" width="284" height="510" rx="56" fill="url(#body)"/>
        ${highlight(486, 480, 420)}
        ${labelText(look, 600, 640, 230)}`;
    case 'pump':
      return `${defs}${shadow}
        <rect x="540" y="282" width="168" height="44" rx="14" fill="url(#cap)"/>
        <rect x="588" y="318" width="26" height="70" fill="url(#cap)"/>
        <rect x="546" y="380" width="110" height="64" rx="10" fill="url(#cap)"/>
        <rect x="438" y="430" width="326" height="520" rx="64" fill="url(#body)"/>
        ${highlight(470, 470, 430)}
        ${labelText(look, 601, 640, 260)}`;
    case 'jar':
      return `${defs}${shadow}
        <rect x="360" y="545" width="480" height="104" rx="24" fill="url(#cap)"/>
        <rect x="372" y="630" width="456" height="320" rx="44" fill="url(#body)"/>
        ${highlight(398, 660, 250)}
        ${labelText(look, 600, 730, 380)}`;
    case 'tube':
      return `${defs}${shadow}
        <rect x="426" y="292" width="348" height="44" rx="6" fill="${darken(look.body, 0.08)}"/>
        <path d="M 440 330 L 760 330 L 690 870 L 510 870 Z" fill="url(#body)"/>
        <rect x="500" y="860" width="200" height="92" rx="20" fill="url(#cap)"/>
        ${highlight(470, 360, 380)}
        ${labelText(look, 600, 500, 260)}`;
    case 'bottle':
      return `${defs}${shadow}
        <rect x="545" y="262" width="110" height="120" rx="12" fill="url(#cap)"/>
        <rect x="562" y="370" width="76" height="80" fill="${darken(look.body, 0.1)}"/>
        <path d="M 450 520 Q 450 440 540 440 L 660 440 Q 750 440 750 520 L 750 900 Q 750 950 700 950 L 500 950 Q 450 950 450 900 Z" fill="url(#body)"/>
        ${highlight(476, 500, 400)}
        ${labelText(look, 600, 640, 260)}`;
    case 'stick':
      return `${defs}${shadow}
        <rect x="528" y="262" width="144" height="262" rx="22" fill="url(#cap)"/>
        <rect x="528" y="532" width="144" height="420" rx="22" fill="url(#body)"/>
        ${highlight(546, 560, 340)}
        ${labelText(look, 600, 660, 120)}`;
    case 'stone':
      return `${defs}${shadow}
        <path d="M 600 300 C 770 280 870 420 820 610 C 790 740 700 860 600 950 C 500 860 410 740 380 610 C 330 420 430 280 600 300 Z" fill="url(#stone)"/>
        <path d="M 540 312 Q 600 360 660 312" fill="none" stroke="${darken(look.body, 0.15)}" stroke-width="10" stroke-linecap="round"/>
        <text x="600" y="640" text-anchor="middle" font-family="${FONT}" font-size="22" letter-spacing="7" fill="${look.label}" opacity="0.8">FJORDBLOOM</text>`;
    case 'box':
      return `${defs}${shadow}
        <rect x="372" y="452" width="456" height="500" rx="16" fill="url(#body)"/>
        <rect x="372" y="452" width="456" height="118" rx="16" fill="url(#cap)"/>
        <rect x="372" y="540" width="456" height="30" fill="url(#cap)"/>
        ${labelText(look, 600, 680, 380)}`;
  }
}

// ---------- scenes ----------
type Scene = 'packshot' | 'lifestyle-1' | 'lifestyle-2';

function background(scene: Scene, width: number, height: number): string {
  const p = brand.palette;
  if (scene === 'packshot') {
    return `<radialGradient id="bg" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EFEBE4"/></radialGradient>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>`;
  }
  if (scene === 'lifestyle-1') {
    return `<rect width="${width}" height="${height}" fill="${p.mist}"/>
      <circle cx="${width * 0.18}" cy="${height * 0.2}" r="${width * 0.22}" fill="${p.moss}" opacity="0.12"/>
      <circle cx="${width * 0.86}" cy="${height * 0.34}" r="${width * 0.16}" fill="${p.cloudberry}" opacity="0.18"/>
      <rect y="${height * 0.72}" width="${width}" height="${height * 0.28}" fill="#E7D9C3"/>
      <rect y="${height * 0.72}" width="${width}" height="6" fill="#D6C5AA"/>
      <ellipse cx="${width * 0.2}" cy="${height * 0.86}" rx="70" ry="38" fill="#9AA39A"/>
      <ellipse cx="${width * 0.27}" cy="${height * 0.9}" rx="46" ry="26" fill="#B7BDB5"/>
      <circle cx="${width * 0.8}" cy="${height * 0.86}" r="20" fill="${p.cloudberry}"/>
      <circle cx="${width * 0.84}" cy="${height * 0.88}" r="16" fill="${lighten(p.cloudberry!, 0.15)}"/>`;
  }
  return `<linearGradient id="bg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${lighten(p.fjord!, 0.08)}"/><stop offset="1" stop-color="${darken(p.fjord!, 0.35)}"/></linearGradient>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <ellipse cx="${width / 2}" cy="${height * 0.22}" rx="${width * 0.45}" ry="${height * 0.14}" fill="#FFFFFF" opacity="0.08"/>
    <rect y="${height * 0.74}" width="${width}" height="${height * 0.26}" fill="${darken(p.fjord!, 0.45)}"/>`;
}

function svgFor(product: Product, scene: Scene, look: Look): string {
  const width = 1200;
  const height = scene === 'packshot' ? 1200 : 1500;
  const offsetY = scene === 'packshot' ? 0 : 170;
  const scale = scene === 'lifestyle-2' ? 1.08 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs>
    ${background(scene, width, height)}
    <g transform="translate(${600 - 600 * scale} ${offsetY}) scale(${scale})">${drawPackaging(product.packaging.type, look)}</g>
  </svg>`;
}

function lookFor(product: Product, unit?: Unit): Look {
  const { body, cap, label } = product.packaging;
  const tinted = unit?.swatch && product.packaging.type === 'stick';
  const bodyColour = tinted ? unit!.swatch! : body;
  const labelColour = tinted ? (luminance(bodyColour) > 0.6 ? '#14212B' : '#F7F5F0') : label;
  const single = product.units.length === 1;
  return {
    body: bodyColour,
    cap,
    label: labelColour,
    title: product.shortName,
    subtitle: unit ? unit.name : single ? product.units[0]!.name : '',
  };
}

async function writeJpeg(svg: string, file: string): Promise<boolean> {
  if (!args.force) {
    try {
      await fs.access(file);
      return false;
    } catch {
      /* missing: write it */
    }
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toFile(file);
  return true;
}

async function main() {
  let written = 0;
  let skipped = 0;
  for (const product of products) {
    const dir = path.join(PUBLIC, productImageDir(product));
    for (const scene of ['packshot', 'lifestyle-1', 'lifestyle-2'] as const) {
      const ok = await writeJpeg(svgFor(product, scene, lookFor(product)), path.join(dir, `${scene}.jpg`));
      ok ? written++ : skipped++;
    }
    if (product.units.length > 1) {
      for (const unit of product.units) {
        const ok = await writeJpeg(svgFor(product, 'packshot', lookFor(product, unit)), path.join(dir, `unit-${unit.id}.jpg`));
        ok ? written++ : skipped++;
      }
    }
  }
  const generic = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
    <rect width="1200" height="1200" fill="${brand.palette.mist}"/>
    <text x="600" y="610" text-anchor="middle" font-family="${FONT}" font-size="44" letter-spacing="14" fill="${brand.palette.fjord}">FJORDBLOOM</text></svg>`;
  (await writeJpeg(generic, path.join(PUBLIC, 'images', 'placeholder.jpg'))) ? written++ : skipped++;
  console.log(`Placeholder images: ${written} written, ${skipped} already present (use --force to redraw).`);
}

await main();
