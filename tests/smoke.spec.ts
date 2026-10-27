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
