# Contributing

This repository is public. Anything committed here can be read, copied and indexed by anyone, forever, even after it is deleted.

## Never commit

- **Secrets.** That means `.env`, API keys, OAuth client IDs and secrets, Netlify tokens and passwords. Keys belong in `.env` (gitignored) or in Netlify environment variables. Never put a secret in a `PUBLIC_` variable or in `src/site.config.ts`.
- **Internal Firework material.** That includes onboarding documents, Confluence, Linear or Slack content, internal tool URLs and screenshots, pricing, roadmap and colleague names.
- **Customer information.** No customer names, channels, URLs, ticket details or repro cases. Reproduce a customer setup at runtime with `?channel=` or the Settings dialog, and keep the notes in internal tools.

Use the gitignored `private/` folder for local notes that must never be pushed.

## Guard rails

- A pre-commit hook blocks `.env` files and `private/`, and runs secretlint on staged files. It is installed by `npm install`.
- CI runs secretlint, content validation, the type check and the build on every pull request.
- If a secret is ever pushed, rotate it immediately. Removing the commit is not enough.

## How to add things

- **A lab component or attribute.** Edit `src/lab/registry.ts`. The lab page, knobs and docs links are generated from it.
- **A known-issue repro.** Copy a page in `src/pages/lab/issues/`. Keep the symptom, cause and fix format, and link it from the component's `knownIssues`.
- **A product.** Add it to `content/catalog/products.json`, keeping the `FJB-<nnn>` and `FJB-<nnn>-<UNIT>` ID scheme. Run `npm run validate` and `npm run gen:placeholders`.
- **A video.** Add a YAML spec in `content/videos/`, named after its `id`. Run `npm run validate`, then the generation commands in the README.
- **A Learn page.** Add a Markdown file in `src/pages/learn/` with `layout`, `title`, `description` and `order` front matter. Only use public sources, and link them.

## Pull requests

Work on a branch and open a pull request. The Netlify deploy preview is the place to check changes on a phone. Run `npm run test:smoke` locally before asking for review.
