// Shared schema for the brand and product catalog.
// Used by the Astro site at build time and by the content scripts, so a bad edit fails fast.
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected a #RRGGBB colour');

export const brandSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  origin: z.string(),
  currency: z.literal('EUR'),
  locales: z.array(z.string()).min(1),
  palette: z.record(z.string(), hex),
  voice: z.string(),
  visualStyle: z.string(),
  disclaimer: z.string(),
});

export const unitSchema = z.object({
  /** Product unit external ID. Used in feeds, the API, hydration and purchase line_items[].sku. */
  id: z.string().regex(/^FJB-\d{3}-[A-Z0-9]+$/),
  name: z.string(),
  option: z.object({ name: z.string(), value: z.string() }),
  price: z.number().positive(),
  /** Original price when the unit is on sale. */
  compareAtPrice: z.number().positive().optional(),
  stock: z.number().int().min(0),
  default: z.boolean().optional(),
  /** Shade colour for tinted units. */
  swatch: hex.optional(),
});

export const packagingSchema = z.object({
  type: z.enum(['dropper', 'pump', 'jar', 'tube', 'bottle', 'stick', 'stone', 'box']),
  body: hex,
  cap: hex,
  label: hex,
});

export const productSchema = z.object({
  /** Product external ID, e.g. FJB-103. The same value goes into the `skus` attribute on product pages. */
  id: z.string().regex(/^FJB-\d{3}$/),
  handle: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  shortName: z.string(),
  category: z.string(),
  summary: z.string(),
  description: z.string(),
  howToUse: z.string(),
  ingredients: z.string(),
  highlights: z.array(z.string()).min(1),
  skinTypes: z.array(z.string()).min(1),
  tags: z.array(z.string()),
  featured: z.boolean().optional(),
  packaging: packagingSchema,
  /** What the packaging looks like, used to prompt the AI packshot. */
  imagePrompt: z.string(),
  /** Optional scene prompts for the two lifestyle images. */
  lifestylePrompts: z.array(z.string()).length(2).optional(),
  units: z.array(unitSchema).min(1),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).min(3),
});

export const catalogSchema = z
  .object({
    currency: z.literal('EUR'),
    products: z.array(productSchema).min(1),
  })
  .superRefine((catalog, ctx) => {
    const ids = new Set<string>();
    const handles = new Set<string>();
    const unitIds = new Set<string>();
    catalog.products.forEach((p, i) => {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', path: ['products', i, 'id'], message: `duplicate product id ${p.id}` });
      if (handles.has(p.handle)) ctx.addIssue({ code: 'custom', path: ['products', i, 'handle'], message: `duplicate handle ${p.handle}` });
      ids.add(p.id);
      handles.add(p.handle);
      const defaults = p.units.filter((u) => u.default).length;
      if (p.units.length > 1 && defaults !== 1) {
        ctx.addIssue({ code: 'custom', path: ['products', i, 'units'], message: `${p.id} needs exactly one default unit` });
      }
      p.units.forEach((u, j) => {
        if (!u.id.startsWith(`${p.id}-`)) {
          ctx.addIssue({ code: 'custom', path: ['products', i, 'units', j, 'id'], message: `${u.id} must start with ${p.id}-` });
        }
        if (unitIds.has(u.id)) ctx.addIssue({ code: 'custom', path: ['products', i, 'units', j, 'id'], message: `duplicate unit id ${u.id}` });
        unitIds.add(u.id);
        if (u.compareAtPrice !== undefined && u.compareAtPrice <= u.price) {
          ctx.addIssue({ code: 'custom', path: ['products', i, 'units', j, 'compareAtPrice'], message: 'compareAtPrice must be higher than price' });
        }
      });
    });
  });

export type Brand = z.infer<typeof brandSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type Product = z.infer<typeof productSchema>;
export type Unit = z.infer<typeof unitSchema>;
