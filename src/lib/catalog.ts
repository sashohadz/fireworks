// Catalog helpers for build-time code (Astro pages, endpoints) and Node scripts.
// Never import this from client-side scripts: it reads the filesystem.
import fs from 'node:fs';
import path from 'node:path';
import rawBrand from '../../content/brand.json' with { type: 'json' };
import rawCatalog from '../../content/catalog/products.json' with { type: 'json' };
import { brandSchema, catalogSchema, type Product, type Unit } from './catalog-schema';

export type { Product, Unit };

export const brand = brandSchema.parse(rawBrand);
export const catalog = catalogSchema.parse(rawCatalog);
export const products: Product[] = catalog.products;

const PUBLIC_DIR = path.join(process.cwd(), 'public');
export const PLACEHOLDER_IMAGE = '/images/placeholder.jpg';

export function getProduct(idOrHandle: string): Product | undefined {
  return products.find((p) => p.id === idOrHandle || p.handle === idOrHandle);
}

export function getUnit(unitId: string): { product: Product; unit: Unit } | undefined {
  for (const product of products) {
    const unit = product.units.find((u) => u.id === unitId);
    if (unit) return { product, unit };
  }
  return undefined;
}

export function defaultUnit(p: Product): Unit {
  return p.units.find((u) => u.default) ?? p.units[0]!;
}

export const isUnitAvailable = (u: Unit) => u.stock > 0;
export const isProductAvailable = (p: Product) => p.units.some(isUnitAvailable);
export const isOnSale = (p: Product) => p.units.some((u) => u.compareAtPrice !== undefined);
export const minPrice = (p: Product) => Math.min(...p.units.map((u) => u.price));
export const hasPriceRange = (p: Product) => new Set(p.units.map((u) => u.price)).size > 1;

/** Hashtag used on Firework videos for the hashtag-filter fallback, e.g. FJB-103 becomes fjb103. */
export const productHashtag = (p: Product) => p.id.toLowerCase().replace(/-/g, '');

export function formatPrice(amount: number, locale = 'en-IE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
}

export function productPath(p: Product, unit?: Unit): string {
  return `/products/${p.handle}${unit ? `?variant=${encodeURIComponent(unit.id)}` : ''}`;
}

export function absoluteUrl(pathname: string, site: string | URL | undefined): string {
  return new URL(pathname, site ?? 'http://localhost:4321').toString();
}

export function imageExists(publicPath: string): boolean {
  return fs.existsSync(path.join(PUBLIC_DIR, publicPath));
}

/** Widths of the WebP copies written by npm run gen:webp, for srcset. */
export const WEBP_WIDTHS = [480, 800] as const;

/** "/images/x/packshot.jpg" → "/images/x/packshot-480.webp". */
export const webpVariantPath = (publicPath: string, width: number): string => publicPath.replace(/\.jpg$/, `-${width}.webp`);

/**
 * srcset of the WebP copies that exist for a store image, or undefined. The JPEG stays in src as the fallback for
 * browsers without srcset, and the feeds keep using it.
 */
export function webpSrcset(publicPath: string): string | undefined {
  const parts = WEBP_WIDTHS.filter((w) => imageExists(webpVariantPath(publicPath, w))).map((w) => `${webpVariantPath(publicPath, w)} ${w}w`);
  return parts.length ? parts.join(', ') : undefined;
}

export function productImageDir(p: Product): string {
  return `/images/products/${p.handle}`;
}

/** Packshot first, then lifestyle images, skipping any that have not been generated yet. */
export function productImages(p: Product): string[] {
  const dir = productImageDir(p);
  const found = ['packshot', 'lifestyle-1', 'lifestyle-2']
    .map((name) => `${dir}/${name}.jpg`)
    .filter(imageExists);
  return found.length > 0 ? found : [PLACEHOLDER_IMAGE];
}

export function unitImage(p: Product, u: Unit): string {
  const own = `${productImageDir(p)}/unit-${u.id}.jpg`;
  return imageExists(own) ? own : productImages(p)[0]!;
}

/** Shape served by the mock commerce API at /api/products.json and /api/products/{id}.json. */
export function toApiProduct(p: Product, site: string | URL | undefined) {
  const unit = defaultUnit(p);
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    summary: p.summary,
    category: p.category,
    url: absoluteUrl(productPath(p), site),
    image: absoluteUrl(productImages(p)[0]!, site),
    available: isProductAvailable(p),
    price: unit.price,
    compareAtPrice: unit.compareAtPrice ?? null,
    currency: catalog.currency,
    units: p.units.map((u) => ({
      id: u.id,
      name: u.name,
      option: u.option,
      price: u.price,
      compareAtPrice: u.compareAtPrice ?? null,
      stock: u.stock,
      available: isUnitAvailable(u),
      isDefault: u === unit,
      url: absoluteUrl(productPath(p, u), site),
      image: absoluteUrl(unitImage(p, u), site),
    })),
  };
}

export type ApiProduct = ReturnType<typeof toApiProduct>;
