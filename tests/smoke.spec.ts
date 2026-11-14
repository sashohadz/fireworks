import { expect, test, type Page } from '@playwright/test';

const pages = [
  '/',
  '/shop',
  '/products/cloudberry-vitamin-c-serum',
  '/products/lingonberry-tinted-lip-balm',
  '/cart',
  '/checkout',
  '/live',
  '/showroom',
  '/help',
  '/help/shipping-returns',
  '/help/ingredients',
  '/lab',
  '/lab/carousel-grid',
  '/lab/storyblock',
  '/lab/player-deck',
  '/lab/hero-unit',
  '/lab/floating-player',
  '/lab/pdp-videos',
  '/lab/styling',
  '/lab/issues',
  '/lab/issues/docked-storyblock-transform',
  '/lab/issues/floating-player-mobile',
  '/learn',
  '/learn/product-map',
  '/learn/web-components',
  '/learn/products-and-ids',
  '/learn/debugging',
  '/learn/go-live-checklist',
  '/lab/accessibility',
  '/lab/ava',
  '/lab/layouts',
  '/lab/arrows',
  '/lab/shopping',
  '/lab/tracking',
  '/lab/bookmarklet',
  '/lab/bookmarklet/practice',
  '/lab/performance',
  '/lab/performance/details',
  '/live/overlays',
  '/pitch',
  '/pitch/eu-beauty-retailer',
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('pages', () => {
  for (const path of pages) {
    test(`${path} renders without script errors`, async ({ page }) => {
      const errors = collectErrors(page);
      // fw=off keeps this test about our own code; the Firework test below covers the SDK.
      const response = await page.goto(`${path}${path.includes('?') ? '&' : '?'}fw=off`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test.describe('data endpoints', () => {
  test('google feed lists every unit', async ({ request }) => {
    const xml = await (await request.get('/feeds/google.xml')).text();
    expect(xml.match(/<item>/g)?.length).toBe(19);
    expect(xml).toContain('<g:item_group_id>FJB-103</g:item_group_id>');
  });

  test('firework csv uses the template header', async ({ request }) => {
    const csv = await (await request.get('/feeds/firework-products.csv')).text();
    expect(csv.startsWith('Name (required),Category (optional)')).toBe(true);
    expect(csv.trim().split('\n')).toHaveLength(20);
  });

  test('AVA knowledge files match the catalog and help pages', async ({ request }) => {
    const faq = await (await request.get('/knowledge/store-faq.txt')).text();
    expect(faq).toContain('Q: Where do you ship?');
    const serum = await request.get('/knowledge/products/FJB-103.txt');
    expect(serum.headers()['content-type']).toContain('text/plain');
    const text = await serum.text();
    expect(text).toContain('Product ID: FJB-103');
    expect(text).toMatch(/Product page: https?:\/\/[^ ]+\/products\/cloudberry-vitamin-c-serum/);
    const shipping = await (await request.get('/knowledge/shipping-and-returns.txt')).text();
    expect(shipping).toContain('Rose Quartz Gua Sha');
    const csv = await (await request.get('/knowledge/ava-test-questions.csv')).text();
    expect(csv.startsWith('"Area","Question","Expected","Source","Result","Notes"')).toBe(true);
  });

  test('mock api returns the catalog', async ({ request }) => {
    const data = await (await request.get('/api/products.json')).json();
    expect(data.products).toHaveLength(12);
    const serum = await (await request.get('/api/products/FJB-103.json')).json();
    expect(serum.units.map((u: { id: string }) => u.id)).toEqual(['FJB-103-15ML', 'FJB-103-30ML']);
  });
});

test('cart to order confirmation', async ({ page }) => {
  await page.goto('/products/cloudberry-vitamin-c-serum?fw=off');
  // Keep the SDK off for the whole flow, so the test never sends a purchase event, even to the sandbox.
  await page.evaluate(() => localStorage.setItem('fjb.settings.v1', JSON.stringify({ fwMode: 'off' })));
  await page.locator('#pdp-add').click();
  await expect(page.locator('[data-cart-count]').first()).toHaveText('1');
  await page.goto('/cart?fw=off');
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.goto('/checkout?fw=off');
  await page.locator('#co-submit').click();
  await page.waitForURL('**/order/confirmed');
  await expect(page.locator('#order-root')).toContainText('FJB-DEMO-');
  await expect(page.locator('#purchase-payload')).toContainText('"sku": "FJB-103-30ML"');
  // The SDK is off, so nothing may be sent to the sandbox channel's analytics.
  await expect(page.locator('#track-status')).toContainText('Not sent');
});

test('sold-out variant cannot be added', async ({ page }) => {
  await page.goto('/products/lingonberry-tinted-lip-balm?fw=off&variant=FJB-109-PLUM');
  await expect(page.locator('#pdp-add')).toBeDisabled();
});

type HookName = 'onProductsLoaded' | 'onWidgetProductsLoaded' | 'onCartDisplayed' | 'onCartUpdated';
interface FakeShopping {
  config?: { url?: string; currency?: string };
  hooks: Partial<Record<HookName, (arg?: unknown) => Promise<unknown>>>;
}
interface BuiltProduct {
  name?: string;
  variants: { extId: string; price: number; originalPrice: number; isAvailable: boolean; url: string }[];
}

/**
 * Stands in for window._fwn.shopping before the page loads, so the shopping hooks can be called directly. The
 * product factory records what the integration builds instead of creating real Firework products.
 */
function installFakeShopping(): void {
  const record = () => {
    const out: Record<string, unknown> = {};
    const builder: Record<string, (arg: unknown) => unknown> = new Proxy(
      {},
      {
        get: (_target, key: string) => (arg: unknown) => {
          if (key === 'variant' || key === 'image') {
            const child = record();
            (arg as (b: unknown) => void)(child.builder);
            if (key === 'image') out.image = child.out;
            else out.variants = [...((out.variants as unknown[] | undefined) ?? []), child.out];
          } else out[key] = arg;
          return builder;
        },
      },
    );
    return { builder, out };
  };
  const fake: FakeShopping = { hooks: {} };
  // Typed loosely: each hook only stores its callback for callHook.
  const hook = (name: HookName) =>
    ((cb: (arg?: unknown) => Promise<unknown>) => {
      fake.hooks[name] = cb;
    }) as never;
  (window as unknown as { __fake: FakeShopping }).__fake = fake;
  window._fwn = {
    shopping: {
      configureCart: (config) => (fake.config = config),
      onProductsLoaded: hook('onProductsLoaded'),
      onWidgetProductsLoaded: hook('onWidgetProductsLoaded'),
      onCartDisplayed: hook('onCartDisplayed'),
      onCartUpdated: hook('onCartUpdated'),
      productFactory: (build) => {
        const r = record();
        build(r.builder as never);
        return r.out;
      },
    },
  };
}

async function withFakeShopping(page: Page): Promise<void> {
  await page.route(/asset\.(fwcdn3|fwscripts)\.com/, (route) => route.abort());
  await page.addInitScript(installFakeShopping);
}

const callHook = (page: Page, name: HookName, arg?: unknown) =>
  page.evaluate(([n, a]) => (window as unknown as { __fake: FakeShopping }).__fake.hooks[n]!(a), [name, arg] as const);

const cartUpdate = (unitId: string, quantity: number, previousQuantity = 0) => ({
  product: { product_ext_id: unitId.split('-').slice(0, 2).join('-') },
  productUnit: { unit_ext_id: unitId },
  quantity,
  previousQuantity,
});

test.describe('shopping integration', () => {
  test('hydration sends the store\'s prices and links, and Add to Bag fills the site\'s bag', async ({ page }) => {
    await withFakeShopping(page);
    await page.goto('/lab/shopping/?shopping=');
    await page.waitForFunction(() => Boolean((window as unknown as { __fake: FakeShopping }).__fake.hooks.onCartUpdated));
    const config = await page.evaluate(() => (window as unknown as { __fake: FakeShopping }).__fake.config);
    expect(config?.url).toMatch(/\/cart$/);

    const hydrated = (await callHook(page, 'onProductsLoaded', { products: [{ product_ext_id: 'FJB-103' }, { product_ext_id: 'NOT-OURS' }] })) as BuiltProduct[];
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]!.variants[0]).toMatchObject({ extId: 'FJB-103-15ML', price: 29, originalPrice: 29, isAvailable: true });
    expect(hydrated[0]!.variants[0]!.url.startsWith(new URL(page.url()).origin)).toBe(true);

    expect(await callHook(page, 'onCartUpdated', cartUpdate('FJB-101-150ML', 2))).toBe(2);
    await expect(page.locator('[data-cart-count]').first()).toHaveText('2');
    await expect(page.locator('#shop-bag')).toContainText('from the video');

    const items = (await callHook(page, 'onCartDisplayed')) as { unitId: string; quantity: number; product: BuiltProduct }[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ unitId: 'FJB-101-150ML', quantity: 2 });
    expect(items[0]!.product.name).toBe('Cloud Milk Cleanser');
    await expect(page.locator('#shop-log tr')).toHaveCount(4);
  });

  test('failure switches come from a fixed list and change the store\'s answers', async ({ page }) => {
    await withFakeShopping(page);
    await page.goto('/lab/shopping/?shopping=sold-out,price-drop,%3Cscript%3E');
    expect(await page.evaluate(() => sessionStorage.getItem('fjb.shopping.v1'))).toBe('sold-out,price-drop');
    await expect(page.locator('#override-banner')).toContainText('Everything sold out');
    await page.waitForFunction(() => Boolean((window as unknown as { __fake: FakeShopping }).__fake.hooks.onCartUpdated));
    const hydrated = (await callHook(page, 'onProductsLoaded', { products: [{ product_ext_id: 'FJB-103' }] })) as BuiltProduct[];
    expect(hydrated[0]!.variants[0]).toMatchObject({ price: 23.2, originalPrice: 29, isAvailable: false });
    await expect(callHook(page, 'onCartUpdated', cartUpdate('FJB-101-150ML', 1))).rejects.toThrow(/sold out/);

    await page.goto('/lab/shopping/?shopping=limit');
    await page.waitForFunction(() => Boolean((window as unknown as { __fake: FakeShopping }).__fake.hooks.onCartUpdated));
    expect(await callHook(page, 'onCartUpdated', cartUpdate('FJB-101-150ML', 5))).toBe(2);

    await page.goto('/lab/shopping/?shopping=');
    expect(await page.evaluate(() => sessionStorage.getItem('fjb.shopping.v1'))).toBeNull();
    await expect(page.locator('#override-banner')).toBeHidden();
  });

  test('stays off on other channels', async ({ page }) => {
    await withFakeShopping(page);
    await page.goto('/lab/shopping/?channel=firework');
    await expect(page.locator('#shop-status')).toContainText('Off');
    expect(await page.evaluate(() => Object.keys((window as unknown as { __fake: FakeShopping }).__fake.hooks))).toEqual([]);
    await expect(page.locator('script[data-fw-sdk][type="module"]')).not.toHaveAttribute('data-fwparam_shopping_cart_style');
  });
});

interface FakeCall {
  event: string;
  page: string;
  payload: Record<string, unknown>;
}

/** Stands in for window._fwn.analytics. Calls are kept for the tab, so a journey across pages can be checked. */
function installFakeAnalytics(): void {
  const call = (event: string) => (payload: unknown) => {
    const calls = JSON.parse(sessionStorage.getItem('__fakeAnalytics') ?? '[]') as unknown[];
    calls.push({ event, page: location.pathname, payload });
    sessionStorage.setItem('__fakeAnalytics', JSON.stringify(calls));
  };
  window._fwn = { analytics: { pageViewed: call('pageViewed'), addToCart: call('addToCart'), removeFromCart: call('removeFromCart'), purchase: call('purchase') } };
}

async function withFakeAnalytics(page: Page): Promise<void> {
  // Nothing reaches Firework: its scripts and its pixel are blocked.
  await page.route(/asset\.(fwcdn3|fwscripts)\.com|fwpixel\.com/, (route) => route.abort());
  await page.addInitScript(installFakeAnalytics);
}

const fakeCalls = (page: Page): Promise<FakeCall[]> => page.evaluate(() => JSON.parse(sessionStorage.getItem('__fakeAnalytics') ?? '[]'));
const fakeEvents = async (page: Page) => (await fakeCalls(page)).map((c) => c.event);

test.describe('tracking', () => {
  test('analytics.js heads the page, and bag changes and the purchase share one order ID', async ({ page }) => {
    await withFakeAnalytics(page);
    await page.goto('/products/cloudberry-vitamin-c-serum');
    await expect(page.locator('head script[data-fw-analytics]')).toHaveAttribute('src', 'https://asset.fwcdn3.com/js/analytics.js');
    const tagFirst = await page.evaluate(() => {
      const tag = document.querySelector('script[data-fw-analytics]')!;
      const sdk = document.querySelector('script[data-fw-sdk]')!;
      return Boolean(tag.compareDocumentPosition(sdk) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(tagFirst).toBe(true);
    await expect.poll(() => fakeEvents(page)).toEqual(['pageViewed']);

    await page.locator('#pdp-add').click();
    await expect.poll(() => fakeEvents(page)).toEqual(['pageViewed', 'addToCart']);
    const added = (await fakeCalls(page))[1]!.payload;
    expect(added).toMatchObject({
      currency: 'EUR',
      subtotal: 48,
      order_value: 48,
      line_items: [{ sku: 'FJB-103-30ML', quantity: 1, price: 48, product_name: 'Cloudberry Vitamin C Glow Serum (30 ml)' }],
    });
    const orderId = added.order_id as string;
    expect(orderId).toMatch(/^FJB-DEMO-/);

    await page.goto('/cart');
    await page.locator('.cart-line button[data-delta="1"]').click();
    await expect.poll(async () => (await fakeEvents(page)).filter((e) => e === 'addToCart')).toHaveLength(2);
    await page.locator('.cart-line button[data-delta="-1"]').click();
    await expect.poll(async () => (await fakeEvents(page)).filter((e) => e === 'removeFromCart')).toHaveLength(1);
    const removed = (await fakeCalls(page)).find((c) => c.event === 'removeFromCart')!.payload;
    expect(removed).toMatchObject({ order_id: orderId, order_value: 48, line_items: [{ sku: 'FJB-103-30ML', quantity: 1, price: 48 }] });

    await page.goto('/checkout');
    await page.locator('#co-submit').click();
    await page.waitForURL('**/order/confirmed');
    await expect(page.locator('#track-status')).toContainText('Sent');
    const calls = await fakeCalls(page);
    expect(calls.find((c) => c.event === 'purchase')!.payload).toMatchObject({ order_id: orderId, line_items: [{ sku: 'FJB-103-30ML', quantity: 1, price: 48 }] });
    // Checkout empties the bag without a removeFromCart, and the next bag gets a new ID.
    expect(calls.filter((c) => c.event === 'removeFromCart')).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('fjb.cart.id.v1'))).toBeNull();

    await page.goto('/lab/tracking');
    await expect(page.locator('#trk-log tr')).toHaveCount(calls.length + 1);
    await expect(page.locator('#trk-log')).toContainText('user:purchase');
  });

  test('the tag loads in lazy mode, but not with fw=off or on other channels', async ({ page }) => {
    await withFakeAnalytics(page);
    await page.goto('/order/confirmed?fw=lazy');
    await expect(page.locator('head script[data-fw-analytics]')).toHaveCount(1);
    await expect(page.locator('script[data-fw-sdk]')).toHaveAttribute('src', /fwn-async\.js$/);
    await expect.poll(() => fakeEvents(page)).toEqual(['pageViewed']);
    for (const query of ['fw=off', 'channel=firework']) {
      await page.goto(`/order/confirmed?${query}`);
      await expect(page.locator('script[data-fw-analytics]')).toHaveCount(0);
    }
    expect(await fakeEvents(page)).toEqual(['pageViewed']);
  });
});

/** The code the "Your site with Firework" bookmark runs, for a given layout. */
async function bookmarkCode(page: Page, layout: string): Promise<string> {
  await page.goto('/lab/bookmarklet');
  await page.selectOption('#bm-layout', layout);
  const href = (await page.locator('#bm-link').getAttribute('href')) ?? '';
  expect(href.startsWith('javascript:')).toBe(true);
  return decodeURIComponent(href.slice('javascript:'.length));
}

const demoStatus = (page: Page) => page.locator('[data-fjb-demo="panel"]').getByRole('status');

test.describe('bookmarklet', () => {
  test('places the chosen layout under the picked block, without following the page\'s links', async ({ page }) => {
    // An empty stand-in for Firework's script: it "loads", so the widgets stay, but nothing reaches Firework.
    await page.route(/asset\.(fwcdn3|fwscripts)\.com/, (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
    const code = await bookmarkCode(page, 'carousel_row');
    await expect(page.locator('#bm-link')).toHaveText('Firework: Carousel');
    await page.goto('/lab/bookmarklet/practice/');
    await page.evaluate(code);
    await expect(demoStatus(page)).toContainText('highlighted block');

    // The block around the heading, then one bigger: the whole section.
    await page.hover('#bestsellers h2');
    await page.keyboard.press('ArrowUp');
    await page.click('#bestsellers h2');
    const widget = page.locator('#bestsellers + [data-fjb-demo="widget"] > fw-embed-feed');
    await expect(widget).toHaveAttribute('channel', 'sashoo_business');
    await expect(widget).toHaveAttribute('playlist', 'o9XklW');
    await expect(widget).toHaveAttribute('mode', 'row');
    await expect(page.locator('script[src$="/module/fwn.js"]')).toHaveAttribute('data-fwparam_tracking_opt_in', 'true');

    // While placing, a click on a link places the videos instead of following the link.
    await page.getByRole('button', { name: 'Place videos' }).click();
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.locator('[data-fjb-demo="widget"]')).toHaveCount(2);
    expect(new URL(page.url()).hash).toBe('');

    await page.getByRole('button', { name: 'Undo' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('[data-fjb-demo="widget"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('a site that only allows its own scripts gets a clear message', async ({ page }) => {
    const code = await bookmarkCode(page, 'floating_player');
    await page.route('https://strict.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        headers: { 'Content-Security-Policy': "script-src 'self'; style-src 'self'" },
        body: '<!doctype html><title>Strict</title><h1>A strict site</h1>',
      }),
    );
    await page.goto('https://strict.test/');
    await page.evaluate(code);
    await expect(page.getByRole('dialog', { name: 'Firework demo' })).toBeVisible();
    await expect(demoStatus(page)).toContainText("security policy");
    await expect(page.locator('[data-fjb-demo="widget"]')).toHaveCount(0);
  });

  test('AVA: the builder shows its own fields, remembers the assistant, and the bookmark places fw-ava', async ({ page }) => {
    await page.route(/asset\.(fwcdn3|fwscripts)\.com/, (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/lab/bookmarklet?fw=off');
    await page.selectOption('#bm-layout', 'ava_button');
    await expect(page.locator('#bm-channel')).toBeHidden();
    await expect(page.locator('#bm-sku')).toBeHidden();
    await page.fill('#bm-assistant', 'prospect1');
    await page.reload();
    await page.selectOption('#bm-layout', 'ava_faq');
    await expect(page.locator('#bm-assistant')).toHaveValue('prospect1');
    await expect(page.locator('#bm-sku')).toBeVisible();
    await page.selectOption('#bm-layout', 'ava_button');
    await expect(page.locator('#bm-link')).toHaveText('Firework: AVA Native Button');
    const href = (await page.locator('#bm-link').getAttribute('href')) ?? '';
    const code = decodeURIComponent(href.slice('javascript:'.length));

    await page.goto('/lab/bookmarklet/practice/');
    await page.evaluate(code);
    await expect(demoStatus(page)).toContainText('AVA will sit under the highlighted block');
    await page.click('.hero h1');
    const ava = page.locator('[data-fjb-demo="widget"] > fw-ava');
    await expect(ava).toHaveAttribute('domain_assistant_id', 'prospect1');
    await expect(ava).toHaveAttribute('layout', 'button');
    await expect(ava).not.toHaveAttribute('sku');
    await expect(page.locator('script[src$="/ava.js?business_id=gYx0PO"]')).toHaveAttribute('data-fwparam_tracking_opt_in', 'true');
  });

  test('the builder only accepts plain channel names and playlist IDs', async ({ page }) => {
    await page.goto('/lab/bookmarklet?fw=off');
    await page.fill('#bm-channel', 'shop"><img src=x>');
    await expect(page.locator('#bm-error')).toBeVisible();
    await expect(page.locator('#bm-link')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#bm-link')).not.toHaveAttribute('href', /^javascript:/);
    await page.fill('#bm-channel', 'my_sandbox');
    await expect(page.locator('#bm-error')).toBeHidden();
    await expect(page.locator('#bm-link')).toHaveAttribute('href', /^javascript:/);
    await page.selectOption('#bm-layout', 'ava_button');
    await page.fill('#bm-assistant', 'x" onload="alert(1)');
    await expect(page.locator('#bm-error')).toContainText('assistant ID');
    await expect(page.locator('#bm-link')).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('performance lab', () => {
  test('the visual view switches page, widgets and loading, and keeps them in the URL', async ({ page, request }) => {
    await page.goto('/lab/performance?fw=off');
    await expect(page.locator('[data-page="product"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-widget="pdp"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.pv-tile')).toHaveCount(4);
    await expect(page.locator('.pv-tile').first()).toContainText('Loads as fast?');
    await expect(page.locator('.pv-tile .pv-badge').first()).toContainText(/\S/);
    // The default state's page map and first frame exist.
    for (const src of await page.locator('.pv-map img, .pv-frame img').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('src')))) {
      expect((await request.get(src!)).status()).toBe(200);
    }
    await page.locator('[data-load="lazy"]').click();
    await expect(page).toHaveURL(/view=product&with=pdp&load=lazy/);
    await expect(page.locator('[data-load="lazy"]')).toHaveAttribute('aria-checked', 'true');
    await page.locator('[data-widget="ava"]').click();
    await expect(page).toHaveURL(/with=pdp%2Cava|with=pdp,ava/);
    await page.locator('[data-page="category"]').click();
    await expect(page.locator('[data-widget="grid"]')).toBeVisible();
    await expect(page.locator('[data-widget="pdp"]')).toHaveCount(0);
    await page.locator('[data-numbers]').check({ force: true });
    await expect(page).toHaveURL(/numbers=1/);
    // Slow 4G (Google's test) is the default; Fast 4G once it has been measured.
    await expect(page.locator('[data-net="slow4g"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#pv-method')).toContainText('Slow 4G');
    const fast = page.locator('[data-net="fast4g"]');
    if (await fast.isEnabled()) {
      await fast.click();
      await expect(page).toHaveURL(/net=fast4g/);
      await expect(page.locator('#pv-method')).toContainText('Fast 4G');
    }
  });

  test('the view ignores unknown values in its URL', async ({ page }) => {
    await page.goto('/lab/performance/?view=evil&with=%3Cimg%20src%3Dx%20id%3Dpwn%3E,pdp&load=sideways&net=warp&fw=off');
    await expect(page.locator('[data-page="product"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-widget="pdp"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-load="on"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-net="slow4g"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#pwn')).toHaveCount(0);
  });

  test('the numbers switch shows the exact values, and the details page has a table per page', async ({ page }) => {
    await page.goto('/lab/performance/?view=product&with=pdp&load=standard&numbers=1&fw=off');
    await expect(page.locator('.pv-nums')).toHaveCount(4);
    await expect(page.locator('.pv-nums').first()).toContainText('Without');
    await page.goto('/lab/performance/details?fw=off');
    await expect(page.locator('.dt-table')).not.toHaveCount(0);
    await expect(page.locator('.dt-table').first()).toContainText('Storyblock');
  });

  test('?widgets= keeps only the listed widgets, including AVA', async ({ page }) => {
    await page.goto('/?widgets=carousel&fw=off');
    await expect(page.locator('[data-fw-managed]')).toHaveCount(1);
    await expect(page.locator('[data-fw-managed]').first()).toHaveAttribute('data-fw-slot', 'carousel');
    await expect(page.locator('#override-banner')).toContainText('Only these widgets: carousel');
    await page.route(/asset\.(fwcdn3|fwscripts)\.com/, (route) => route.abort());
    await page.goto('/products/cloudberry-vitamin-c-serum/?widgets=pdp');
    await expect(page.locator('fw-ava')).toHaveCount(0);
    await expect(page.locator('script[data-ava-sdk]')).toHaveCount(0);
    await page.goto('/products/cloudberry-vitamin-c-serum/?widgets=pdp,ava');
    await expect(page.locator('fw-ava')).toHaveCount(1);
    await page.goto('/products/cloudberry-vitamin-c-serum/?widgets=%3Cscript%3E,deck&fw=off');
    await expect(page.locator('[data-fw-managed]')).toHaveCount(1);
    await expect(page.locator('#override-banner')).toContainText('Only these widgets: deck');
  });

  test('widgets keep their space with Firework on, and none with it off or hidden', async ({ page }) => {
    // Firework's scripts are blocked: the widgets never render, so only the reserved space is measured.
    await page.route(/asset\.(fwcdn3|fwscripts)\.com/, (route) => route.abort());
    await page.goto('/shop/?widgets=grid,stories');
    await expect(page.locator('.fw-reserve')).toHaveCount(2);
    expect(Math.round((await page.locator('.fw-reserve').first().boundingBox())!.height)).toBe(136);
    await page.goto('/shop/?widgets=grid');
    await expect(page.locator('.fw-reserve')).toHaveCount(1);
    await page.goto('/shop/?widgets=grid,stories&fw=off');
    await expect(page.locator('html')).toHaveAttribute('data-fw-early', 'off');
    for (const box of await page.locator('.fw-reserve').all()) expect((await box.boundingBox())!.height).toBe(0);
  });

  test('measures a setup in this browser, in all three modes', async ({ page }) => {
    test.setTimeout(120_000);
    // Firework's scripts are blocked, so the "on" and "lazy" steps load nothing from Firework and finish quickly.
    await page.route(/asset\.(fwcdn3|fwscripts)\.com|fwpixel\.com/, (route) => route.abort());
    await page.goto('/lab/performance/details?fw=off');
    for (const box of await page.locator('input[name="setup"]').all()) {
      if ((await box.getAttribute('data-page')) !== 'product') await box.uncheck();
      else await box.check();
    }
    await page.getByRole('button', { name: 'Run in this browser' }).click();
    await page.waitForURL(/\/products\/cloudberry-vitamin-c-serum\/\?widgets=&fw=off&perf=/);
    await page.waitForURL(/lab\/performance\/details\/?#live/, { timeout: 90_000 });
    const rows = page.locator('.perf-live-table tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Without Firework');
    await expect(rows.nth(1)).toContainText('Standard loading');
    await expect(rows.nth(2)).toContainText('Lazy loading');
    const run = await page.evaluate(() => JSON.parse(sessionStorage.getItem('fjb.perf.v1') ?? 'null'));
    expect(run.results.map((r: { mode: string }) => r.mode)).toEqual(['off', 'on', 'lazy']);
    expect(run.results[0].requests).toBeGreaterThan(5);
    expect(run.results[0].bytes).toBeGreaterThan(10_000);
    expect(run.results[0].fcp).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Clear results' }).click();
    await expect(rows).toHaveCount(0);
  });
});

test.describe('demo tools', () => {
  test('pitch mode hides demo tools and moves between steps', async ({ page }) => {
    // Keep the SDK off on every page the pitch visits.
    await page.goto('/?fw=off');
    await page.evaluate(() => localStorage.setItem('fjb.settings.v1', JSON.stringify({ fwMode: 'off' })));
    await page.goto('/?present=eu-beauty-retailer');
    const count = page.locator('.pitch-bar-count');
    const gear = page.locator('.header-actions [data-open-settings]');
    await expect(count).toHaveText(/^1\/\d+$/);
    await expect(page.locator('html')).toHaveAttribute('data-present', 'on');
    await expect(gear).toBeHidden();
    await expect(page).not.toHaveURL(/present=/);
    await page.locator('.pitch-bar [data-pitch="next"]').click();
    await expect(count).toHaveText(/^2\//);
    await page.locator('.pitch-bar [data-pitch="next"]').click();
    await expect(page).toHaveURL(/\/products\/cloudberry-vitamin-c-serum/);
    await expect(count).toHaveText(/^3\//);
    await expect(page.locator('p.ids')).toBeHidden();
    await page.locator('.pitch-bar [data-pitch="exit"]').click();
    await expect(page.locator('.pitch-bar')).toHaveCount(0);
    await expect(gear).toBeVisible();
  });

  test('overlays show URL text as plain text', async ({ page }) => {
    await page.goto('/live/overlays/announcement/?text=%3Cb%3EHello%3C%2Fb%3E&code=GLOW15');
    await expect(page.locator('.announce-text')).toHaveText('<b>Hello</b>');
    await expect(page.locator('.announce-code')).toHaveText('GLOW15');
    await page.goto('/live/overlays/product/?sku=FJB-106');
    await expect(page.locator('#spot-name')).toHaveText('Arctic Barrier Day Cream');
    await expect(page.locator('#spot-compare')).toBeVisible();
  });

  test('showroom shows the restream and the next session', async ({ page }) => {
    await page.goto('/showroom?fw=off');
    await expect(page.locator('fw-herounit')).toHaveAttribute('playlist', /.+/);
    await expect(page.locator('#showroom-next-text')).toContainText(/Next session|On now/);
  });

  test('lab links only apply documented attributes', async ({ page }) => {
    const handler = encodeURIComponent("document.body.dataset.poc='ran'");
    await page.goto(`/lab/carousel-grid?fw=off&a.mode=grid&a.onmouseover=${handler}&a.page_url=javascript:alert(1)&css.--not-a-widget-var=red`);
    const widget = page.locator('#lab-stage [data-lab]');
    await expect(widget).toHaveAttribute('mode', 'grid');
    await expect(widget).not.toHaveAttribute('onmouseover');
    await expect(widget).not.toHaveAttribute('page_url');
    await widget.dispatchEvent('mouseover');
    expect(await page.evaluate(() => document.body.dataset.poc ?? 'not run')).toBe('not run');
    await expect(page.locator('#lab-snippet')).not.toContainText('--not-a-widget-var');
  });

  test('the layout gallery shows all 12 Business Portal layouts', async ({ page }) => {
    await page.goto('/lab/layouts?fw=off');
    const cards = page.locator('.layout-card');
    await expect(cards).toHaveCount(12);
    for (const name of ['Dynamic Carousel', 'Horizontal Carousel', 'Circle Stories', 'Vertical Stories', 'Horizontal Player', 'Player Deck Grid']) {
      await expect(page.locator('.layout-card h2', { hasText: name })).toHaveCount(1);
    }
    await expect(page.locator('#dynamic_carousel .key')).toContainText('thumbnail_style="dynamic"');
    await expect(page.locator('#code-dynamic_carousel')).toContainText('thumbnail_style="dynamic"');
    await expect(page.locator('#code-horizontal_player')).toContainText('aspect-ratio: 16/9');
  });

  test('layout chips switch the lab widget to another Business Portal layout', async ({ page }) => {
    await page.goto('/lab/carousel-grid?fw=off');
    await expect(page.locator('#lab-layouts [data-layout="carousel_row"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#lab-layouts [data-layout="dynamic_carousel"]').click();
    await expect(page.locator('#lab-stage [data-lab]')).toHaveAttribute('thumbnail_style', 'dynamic');
    await expect(page.locator('#lab-layouts [data-layout="dynamic_carousel"]')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/lab/carousel-grid?fw=off&a.thumbnail_shape=circle');
    await expect(page.locator('#lab-stage [data-lab]')).toHaveAttribute('thumbnail_shape', 'circle');
    await expect(page.locator('#lab-layouts [data-layout="circle_stories"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('custom arrows: picking a style sets both arrow attributes', async ({ page, request }) => {
    const svg = await request.get('/arrows/chevron-next.svg');
    expect(svg.headers()['content-type']).toContain('image/svg+xml');
    await page.goto('/lab/arrows?fw=off');
    await expect(page.locator('[data-arrow]')).toHaveCount(7);
    await page.locator('[data-arrow="fjord-circle"]').click();
    await expect(page.locator('[data-arrow="fjord-circle"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#arrow-code')).toContainText('/arrows/fjord-circle-next.svg');
    await expect(page.locator('#arrow-code')).toContainText('/arrows/fjord-circle-previous.svg');
    await expect(page).toHaveURL(/arrow=fjord-circle/);
  });

  test('lab links only accept this site\'s own arrow files', async ({ page }) => {
    await page.goto('/lab/carousel-grid?fw=off&a.ui_asset_next=https://example.com/x.svg&a.ui_asset_previous=/arrows/chevron-previous.svg');
    const widget = page.locator('#lab-stage [data-lab]');
    await expect(widget).not.toHaveAttribute('ui_asset_next');
    await expect(widget).toHaveAttribute('ui_asset_previous', '/arrows/chevron-previous.svg');
  });

  test('the shop page has a circle stories row', async ({ page }) => {
    await page.goto('/shop?fw=off');
    await expect(page.locator('fw-embed-feed[thumbnail_shape="circle"]')).toHaveCount(1);
  });

  test('checklist ticks survive a reload', async ({ page }) => {
    await page.goto('/learn/go-live-checklist?fw=off');
    await page.locator('label[for="check-0"]').click();
    await page.reload();
    await expect(page.locator('#check-0')).toBeChecked();
    await expect(page.locator('.checklist-progress')).toContainText('1 of');
  });

  test('accessibility audit runs', async ({ page }) => {
    await page.goto('/lab/accessibility?fw=off');
    await page.selectOption('#a11y-scope', 'page');
    await page.locator('#a11y-run').click();
    await expect(page.locator('#a11y-summary')).toContainText(/axe-core|rules failed/, { timeout: 30_000 });
  });
});

test.describe('firework sdk (network)', () => {
  test.skip(process.env.OFFLINE === '1', 'needs network access to Firework');
  const channel = process.env.TEST_CHANNEL ?? 'firework';

  test('other channels load the SDK with tracking opt-in', async ({ page }) => {
    await page.goto('/?channel=firework');
    await expect(page.locator('script[data-fw-sdk][type="module"]')).toHaveAttribute('data-fwparam_tracking_opt_in', 'true');
    await page.goto('/');
    await expect(page.locator('script[data-fw-sdk][type="module"]')).not.toHaveAttribute('data-fwparam_tracking_opt_in');
  });

  test('widgets upgrade and fire events', async ({ page }) => {
    await page.goto(`/lab/storyblock?channel=${encodeURIComponent(channel)}`);
    await page.waitForFunction(() => Boolean(window._fwn && customElements.get('fw-storyblock')), null, { timeout: 30_000 });
    // fw:ready and fw:shopping:ready arrive first; wait for the widget's own events.
    await page.waitForFunction(
      () => ((window.__fjb?.events as { type: string }[] | undefined) ?? []).some((e) => e.type.startsWith('fw:storyblock:')),
      null,
      { timeout: 30_000 },
    );
    const types = await page.evaluate(() => (window.__fjb?.events as { type: string }[]).map((e) => e.type));
    expect(types).toContain('fw:storyblock:render');
  });

  test('a product without tagged videos hides its Storyblock', async ({ page }) => {
    // FJB-111 has no video in content/videos, so the sandbox returns no feed for skus="FJB-111".
    await page.goto('/products/rose-quartz-gua-sha');
    await expect(page.locator('.fw-failed-note')).toContainText('skus="FJB-111"', { timeout: 30_000 });
    await expect(page.locator('fw-storyblock[skus="FJB-111"]')).toBeHidden();
  });

  test('the shopping hooks run with the real SDK', async ({ page }) => {
    // The sandbox channel, because the integration only runs there.
    await page.goto('/lab/shopping/?shopping=');
    await expect(page.locator('script[data-fw-sdk][type="module"]')).toHaveAttribute('data-fwparam_shopping_cart_style', 'bag');
    await page.waitForFunction(
      () => ((window.__fjb?.shopping as { log: { hook: string; error: boolean }[] } | undefined)?.log ?? []).some((e) => /ProductsLoaded/.test(e.hook) && !e.error),
      null,
      { timeout: 30_000 },
    );
  });

  test('analytics.js alone sends page views on a page without widgets', async ({ page }) => {
    // Read the pixel requests and block them, so the sandbox's analytics get nothing from tests.
    const sent: string[] = [];
    await page.route(/\/trk\//, (route) => {
      sent.push(new URL(route.request().url()).pathname);
      return route.abort();
    });
    // Lazy mode on the confirmation page: no widget, so fwn-async.js never loads the SDK.
    await page.goto('/order/confirmed?fw=lazy');
    await expect.poll(() => sent, { timeout: 30_000 }).toContain('/trk/user:page_viewed');
    expect(await page.evaluate(() => typeof window._fwn?.shopping)).toBe('undefined');
  });

  test('the bookmark shows a real carousel on a page without Firework', async ({ page }) => {
    await page.route(/\/trk\//, (route) => route.abort());
    const code = await bookmarkCode(page, 'carousel_row');
    await page.goto('/lab/bookmarklet/practice/');
    await page.evaluate(() => document.addEventListener('fw:embed-feed:content-ready', () => (document.body.dataset.fwReady = 'yes')));
    await page.evaluate(code);
    await page.click('.hero h1');
    await expect(page.locator('body')).toHaveAttribute('data-fw-ready', 'yes', { timeout: 30_000 });
    await expect(demoStatus(page)).toContainText('Carousel added');
  });

  test('the bookmark shows AVA on a page without Firework', async ({ page }) => {
    await page.route(/\/trk\//, (route) => route.abort());
    const code = await bookmarkCode(page, 'ava_button');
    await page.goto('/lab/bookmarklet/practice/');
    await page.evaluate(code);
    await page.click('.hero h1');
    const ava = page.locator('[data-fjb-demo="widget"] > fw-ava');
    await expect.poll(async () => (await ava.boundingBox())?.height ?? 0, { timeout: 30_000 }).toBeGreaterThan(20);
  });

  test('fw=off skips the SDK', async ({ page }) => {
    await page.goto('/?fw=off');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => typeof window._fwn)).toBe('undefined');
  });

  test('fw=off also skips AVA', async ({ page }) => {
    await page.goto('/products/cloudberry-vitamin-c-serum?fw=off');
    await page.waitForTimeout(1500);
    await expect(page.locator('script[data-ava-sdk]')).toHaveCount(0);
    expect(await page.evaluate(() => typeof window._fwn)).toBe('undefined');
  });

  test('AVA loads on product pages with the product ID as sku', async ({ page }) => {
    await page.goto('/products/cloudberry-vitamin-c-serum');
    await expect(page.locator('fw-ava[layout="faq"]')).toHaveAttribute('sku', 'FJB-103');
    await expect(page.locator('script[data-ava-sdk]')).toHaveCount(1);
    await page.waitForFunction(() => Boolean(customElements.get('fw-ava')), null, { timeout: 30_000 });
  });
});
