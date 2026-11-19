import { fromLiveApi, fromSnapshot, type ApiProduct } from '../src/shopping/api';
import { resolveProducts, toFireworkProduct, type Deps } from '../src/shopping/hydration';
import snapshot from '../src/shopping/catalog.snapshot.json';

const catalog = (snapshot as { products: ApiProduct[] }).products;
const byId = (id: string) => catalog.find((p) => p.id === id)!;

const deps = (live?: Deps['live']): Deps => ({
  live: live ?? (async (ids) => fromSnapshot(ids)),
  snapshot: (ids) => fromSnapshot(ids),
});

describe('toFireworkProduct', () => {
  test('maps every unit, with IDs Firework knows', () => {
    const p = toFireworkProduct(byId('FJB-109'));
    expect(p.productId).toBe('FJB-109');
    expect(p.units?.map((u) => u.unitId)).toEqual(byId('FJB-109').units.map((u) => u.id));
    expect(p.units?.every((u) => u.price?.currencyCode === 'EUR')).toBe(true);
  });

  test('regular price is the original price, so no false sale', () => {
    const u = toFireworkProduct(byId('FJB-101')).units![0]!;
    expect(u.originalPrice?.amount).toBe(u.price?.amount);
  });

  test('a real sale keeps its compare-at price as the original', () => {
    const api = byId('FJB-106').units[0]!;
    const u = toFireworkProduct(byId('FJB-106')).units![0]!;
    expect(u.price?.amount).toBe(api.price);
    expect(u.originalPrice?.amount).toBe(api.compareAtPrice);
  });

  test('stock: sold-out units stay unavailable', () => {
    const p = toFireworkProduct(byId('FJB-111'));
    expect(p.isAvailable).toBe(false);
    expect(p.units?.[0]?.isAvailable).toBe(false);
  });

  test('−20% sale: price × 0.8 in cents, regular price struck through', () => {
    const api = byId('FJB-101').units[0]!;
    const u = toFireworkProduct(byId('FJB-101'), { sale: 0.8 }).units![0]!;
    expect(u.price?.amount).toBe(Math.round(api.price * 80) / 100);
    expect(u.originalPrice?.amount).toBe(api.price);
  });

  test('sold out mode: product and every unit unavailable', () => {
    const p = toFireworkProduct(byId('FJB-101'), { soldOut: true });
    expect(p.isAvailable).toBe(false);
    expect(p.units?.every((u) => u.isAvailable === false)).toBe(true);
  });
});

describe('resolveProducts', () => {
  test('repeated IDs are looked up once; unknown IDs are left to Firework', async () => {
    const live = jest.fn(async (ids: string[]) => fromSnapshot(ids));
    const r = await resolveProducts(['FJB-103', 'FJB-103', 'NOT-OURS'], 'live', deps(live));
    expect(live).toHaveBeenCalledWith(['FJB-103', 'NOT-OURS']);
    expect(r.products.map((p) => p.productId)).toEqual(['FJB-103']);
    expect(r.lookup.unknown).toEqual(['NOT-OURS']);
    expect(r.via).toBe('Live API');
  });

  test('hardcoded mode never calls the API', async () => {
    const live = jest.fn();
    const r = await resolveProducts(['FJB-101'], 'hardcoded', deps(live));
    expect(live).not.toHaveBeenCalled();
    expect(r.via).toBe('Hardcoded');
  });

  test('an unreachable API falls back to the bundled copy', async () => {
    const r = await resolveProducts(['FJB-101'], 'live', deps(async () => { throw new Error('offline'); }));
    expect(r.products).toHaveLength(1);
    expect(r.via).toMatch(/unreachable/);
  });

  test('failing mode throws', async () => {
    await expect(resolveProducts(['FJB-101'], 'failing', deps())).rejects.toThrow(/Failing/);
  });
});

describe('fromLiveApi', () => {
  test('one request per product; 404 means unknown', async () => {
    const urls: string[] = [];
    const fake = async (url: string) => {
      urls.push(url);
      const id = decodeURIComponent(url.split('/').pop()!.replace('.json', ''));
      const p = catalog.find((x) => x.id === id);
      return { status: p ? 200 : 404, body: p ?? null };
    };
    const r = await fromLiveApi(['FJB-101', 'NOPE'], fake);
    expect(urls).toEqual(['https://fjordbloom.netlify.app/api/products/FJB-101.json', 'https://fjordbloom.netlify.app/api/products/NOPE.json']);
    expect(r.found.map((p) => p.id)).toEqual(['FJB-101']);
    expect(r.unknown).toEqual(['NOPE']);
  });

  test('a server error is an error, not "unknown"', async () => {
    await expect(fromLiveApi(['FJB-101'], async () => ({ status: 500, body: null }))).rejects.toThrow(/500/);
  });
});
