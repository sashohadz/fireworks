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
  trailingSlash: 'ignore',
});
