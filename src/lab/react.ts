// The "In a React app" section on /lab/shopping: what stays the same and what changes when the shop's front end is
// React (or Next.js). Shown as a sketch, not run: this store isn't React, and the Firework side doesn't change.

export const reactDifferences: { topic: string; same: string; changes: string }[] = [
  {
    topic: 'Firework script',
    same: 'One script tag (fwn.js), the same for every framework.',
    changes: 'Load it once, in the browser only: no server-side rendering. In Next.js, a client component or next/script.',
  },
  {
    topic: 'Widgets',
    same: 'The same web components and attributes (<fw-storyblock channel playlist>).',
    changes: 'Written in JSX as custom elements. Declare their types once for TypeScript.',
  },
  {
    topic: 'Shopping hooks',
    same: 'The same hooks, data and failure behaviour as on this page.',
    changes: 'Register them once at the app root. They are global and can’t be removed, and React’s StrictMode runs effects twice in development.',
  },
  {
    topic: 'Country and cart',
    same: 'Your API decides prices, currency and stock; your bag stays the only bag.',
    changes: 'Hooks read the current country and bag from your store (Redux, Zustand…) when called, not from values captured at setup.',
  },
  {
    topic: 'Tracking',
    same: 'analytics.purchase on the order confirmation, every order.',
    changes: 'In a single-page app, report page views on route changes, and make sure the purchase runs once.',
  },
  {
    topic: 'Your app',
    same: 'Same ideas: hydration, cart sync, purchase.',
    changes: 'A different SDK (react-native-firework-sdk) with its own callbacks. Share the data layer (product API, prices per country, bag service), not the Firework wiring.',
  },
];

export const reactSketch = `// Once, at the app root, in the browser only ("use client" in Next.js).
import { useEffect } from 'react';
import { shop } from './shop'; // your store: country, bag, product API

let registered = false; // Firework's hooks are global and can't be removed

export function FireworkShopping() {
  useEffect(() => {
    const install = () => {
      const shopping = window._fwn?.shopping;
      if (registered || !shopping) return;
      registered = true;
      shopping.configureCart({ url: '/cart', currency: shop.country().currency });

      // Read the country and bag when Firework calls, not when the effect ran.
      shopping.onProductsLoaded(async ({ products }) => {
        const country = shop.country();
        const list = await shop.api.products(country.id, products.map((p) => p.product_ext_id));
        return list.map((p) => toFirework(shopping, p, country.currency)); // productFactory
      });
      shopping.onCartUpdated(async (u) => shop.bag.set(u.productUnit.unit_ext_id, u.quantity)); // throw = error in the player
      shopping.onCartDisplayed(async () => shop.bag.lines().map((l) => toFireworkBagItem(shopping, l)));
    };
    install();
    document.addEventListener('fw:ready', install); // fw:ready can come before _fwn.shopping exists
    return () => document.removeEventListener('fw:ready', install);
  }, []);
  return null;
}

// Widgets stay web components: <fw-storyblock channel="…" playlist="…" />
`;
