// @ts-check
import { defineConfig } from 'astro/config';

// Product feeds and the mock API need absolute URLs.
// Netlify sets URL to the production URL during builds; SITE_URL overrides it locally.
const site = process.env.SITE_URL || process.env.URL || 'http://localhost:4321';

export default defineConfig({
  site,
  output: 'static',
  // Keep classic whitespace handling so inline elements and code snippets render as written.
  compressHTML: true,
  devToolbar: { enabled: false },
  // The stylesheet goes inline in each page: it was the only render-blocking request (3.7 KB compressed).
  build: { inlineStylesheets: 'always' },
  trailingSlash: 'ignore',
  // axe-core (about 650 kB) is its own chunk, loaded only when an audit runs on /lab/accessibility.
  vite: { build: { chunkSizeWarningLimit: 700 } },
});
