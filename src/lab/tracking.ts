// What a developer adds to their store for Firework tracking, shown on /lab/tracking.
// Same calls as src/scripts/tracking.ts, without this site's sandbox checks and log.

export const trackingSnippet = `<!-- 1. In the <head> of every page that sends tracking events. -->
<script async type="text/javascript" src="//asset.fwcdn3.com/js/analytics.js"></script>

<script>
  // "customer", "cart" and "order" stand for your own store's data.

  // 2. analytics.js loads async, so wait for it. Calling window._fwn.analytics on
  //    DOMContentLoaded, as in the docs' examples, is usually too early.
  function whenAnalyticsReady(fn) {
    if (window._fwn?.analytics) return fn(window._fwn.analytics);
    document.addEventListener('fw:ready', function ready() {
      if (!window._fwn?.analytics) return;
      document.removeEventListener('fw:ready', ready);
      fn(window._fwn.analytics);
    });
  }

  // 3. Every page, once. Send your customer ID when the shopper is signed in.
  whenAnalyticsReady((analytics) =>
    analytics.pageViewed(customer ? { ext_customer_identifier: customer.id } : {}),
  );

  // 4. In your cart code, after the cart accepted a change, including changes from
  //    Add to Bag in a video. line_items is what was added or removed.
  function trackCartChange(unit, change) {
    const quantity = Math.abs(change);
    const payload = {
      order_id: cart.id,
      currency: 'EUR',
      subtotal: unit.price * quantity,
      order_value: unit.price * quantity,
      // sku: the external ID imported into Firework, or the unit's SKU, GTIN or MPN.
      line_items: [{ sku: unit.externalId, quantity, price: unit.price, product_name: unit.name }],
    };
    whenAnalyticsReady((analytics) =>
      change > 0 ? analytics.addToCart(payload) : analytics.removeFromCart(payload),
    );
  }

  // 5. On the order confirmation page, for every order, not only orders from videos.
  whenAnalyticsReady((analytics) =>
    analytics.purchase({
      order_id: order.id,
      currency: order.currency,
      subtotal: order.subtotal, // before discounts, taxes and shipping
      order_value: order.total, // what the shopper paid
      line_items: order.lines.map((l) => ({
        sku: l.externalId,
        quantity: l.quantity,
        price: l.price, // unit price after line discounts
        product_name: l.name,
      })),
    }),
  );
</script>`;
