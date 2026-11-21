import { store } from '../src/config';
import { MARKETS, type Market } from '../src/market';
import { CACHE_MS, clearPriceLists, fromCache, fromLiveApi, fromSnapshot, prefetchMarket, snapshotProducts } from '../src/shopping/api';
import { resolveProducts, toFireworkProduct, type Deps } from '../src/shopping/hydration';

const [DE, CH, PL] = MARKETS as [Market, Market, Market];
const catalog = snapshotProducts('de');
const byId = (id: string) => catalog.find((p) => p.id === id)!;

const deps = (live?: Deps['live'], market: Market = DE): Deps => ({
  market: () => market,
  live: live ?? (async (ids, m) => fromSnapshot(ids, m.id)),
  snapshot: (ids, m) => fromSnapshot(ids, m.id),
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
    const live = jest.fn(async (ids: string[], m: Market) => fromSnapshot(ids, m.id));
    const r = await resolveProducts(['FJB-103', 'FJB-103', 'NOT-OURS'], 'live', deps(live));
    expect(live).toHaveBeenCalledWith(['FJB-103', 'NOT-OURS'], DE);
    expect(r.products.map((p) => p.productId)).toEqual(['FJB-103']);
    expect(r.lookup.unknown).toEqual(['NOT-OURS']);
    expect(r.via).toBe('Live API · DE · EUR');
  });

  test('hardcoded mode never calls the API', async () => {
    const live = jest.fn();
    const r = await resolveProducts(['FJB-101'], 'hardcoded', deps(live));
    expect(live).not.toHaveBeenCalled();
    expect(r.via).toBe('Hardcoded · DE · EUR');
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
    const r = await fromLiveApi(['FJB-101', 'NOPE'], 'de', fake);
    expect(urls).toEqual([`${store.api}/de/products/FJB-101.json`, `${store.api}/de/products/NOPE.json`]);
    expect(r.found.map((p) => p.id)).toEqual(['FJB-101']);
    expect(r.unknown).toEqual(['NOPE']);
  });

  test('a server error is an error, not "unknown"', async () => {
    await expect(fromLiveApi(['FJB-101'], 'de', async () => ({ status: 500, body: null }))).rejects.toThrow(/500/);
  });
});

describe('countries', () => {
  test('the market picks the price list and currency the player gets', async () => {
    const ch = await resolveProducts(['FJB-101'], 'live', deps(undefined, CH));
    expect(ch.products[0]!.currency).toBe('CHF');
    expect(ch.products[0]!.units![0]).toMatchObject({ unitId: 'FJB-101-150ML', price: { amount: 26.9, currencyCode: 'CHF' } });
    const pl = await resolveProducts(['FJB-101'], 'hardcoded', deps(undefined, PL));
    expect(pl.products[0]!.units![0]!.price).toEqual({ amount: 103.99, currencyCode: 'PLN' });
  });

  test('a product the country does not sell comes back hidden, not as unknown', async () => {
    const r = await resolveProducts(['FJB-101', 'FJB-107'], 'live', deps(undefined, CH));
    expect(r.hidden).toEqual(['FJB-107']);
    expect(r.products.find((p) => p.productId === 'FJB-107')).toEqual({ productId: 'FJB-107', hidden: true });
    expect(r.lookup.unknown).toEqual([]);
    const de = await resolveProducts(['FJB-107'], 'live', deps(undefined, DE));
    expect(de.hidden).toEqual([]);
    expect(de.products[0]!.currency).toBe('EUR');
  });

  test('every market has a bundled catalog', () => {
    expect(snapshotProducts('de')).toHaveLength(12);
    expect(snapshotProducts('ch').some((p) => p.id === 'FJB-107')).toBe(false);
    expect(snapshotProducts('pl')[0]!.currency).toBe('PLN');
  });
});

describe('price list in memory', () => {
  const fakeList = (market: string) => async (url: string) => {
    expect(url).toBe(`${store.api}/${market}/products.json`);
    return { status: 200, body: { products: snapshotProducts(market as 'ch') } };
  };

  test('nothing until the country is loaded; then answers without a request, unsold = unknown', async () => {
    clearPriceLists();
    expect(fromCache(['FJB-101'], 'ch')).toBeUndefined();
    expect(await prefetchMarket('ch', fakeList('ch'))).toBe(11);
    const hit = fromCache(['FJB-101', 'FJB-107'], 'ch')!;
    expect(hit.cached).toBe(true);
    expect(hit.found.map((p) => p.id)).toEqual(['FJB-101']);
    expect(hit.unknown).toEqual(['FJB-107']);
    expect(fromCache(['FJB-101'], 'pl')).toBeUndefined();
  });

  test('older than five minutes: asked again', async () => {
    clearPriceLists();
    await prefetchMarket('ch', fakeList('ch'));
    expect(fromCache(['FJB-101'], 'ch', Date.now() + CACHE_MS + 1)).toBeUndefined();
  });

  test('hydration names the source: cached or not', async () => {
    const cached = await resolveProducts(['FJB-101'], 'live', deps(async (ids, m) => ({ ...fromSnapshot(ids, m.id), cached: true }), CH));
    expect(cached.via).toBe('Live API, cached · CH · CHF');
  });
});
