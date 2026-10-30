# Fjordbloom: a Firework demo store and lab

Fjordbloom is a fictional Nordic skincare brand. This site uses it to show how [Firework](https://firework.com) shoppable video, livestream shopping and AVA work on a real-looking store. It serves four jobs:

- **Learning.** Every Firework web component, live, with each documented attribute as a control.
- **Troubleshooting.** Reproduce customer issues, watch every `fw:*` event, and point the site at any channel.
- **Demos and pitches.** A believable beauty store with product videos, a livestream and a cart.
- **Team reuse.** Teammates can use the deployed site with their own sandbox, without forking.

Nothing here is for sale. Products, images and videos are illustrated or AI-generated. This is not an official Firework project.

## What's inside

| Area | Path | What it shows |
|---|---|---|
| Storefront | `/`, `/shop`, `/products/*`, `/cart` | Hero unit, Storyblock, carousel, grid, Player Deck, floating player, product-page videos via `skus`, cart and purchase tracking |
| Live and Showroom | `/live`, `/showroom` | Live: the hosted show, its countdown and replays. Showroom: a daily restream with AI Copilot answering the chat, and the next session in the visitor's time zone |
| OBS overlays | `/live/overlays` | Browser-source overlays at 720x1280 (name strap, product spotlight, giveaway, starting soon) and the OBS settings Firework needs |
| Pitch mode | `/pitch` | Presents the store as a customer demo: demo tools hidden, presenter notes in a second window |
| Custom arrows | `/lab/arrows`, `/arrows/*.svg` | Six SVG arrow styles for `ui_asset_next` and `ui_asset_previous`, switchable on a live carousel, served with CORS for reuse |
| Layouts | `/lab/layouts` | All 12 Business Portal layouts live, grouped by the five elements behind them, with the attributes that make each one |
| Lab | `/lab` | One page per component with attribute knobs, the exact embed code, CSS variables, an event log and known tickets. Also an accessibility check with axe-core and a shadow-DOM focus tracker |
| AVA | `/products/*`, `/help`, `/lab/ava`, `/knowledge/*` | AVA's Product FAQ Widget on every product page and its General Button on Help. The setup kit has the embed plan, knowledge files built from the catalog and help pages, suggested settings and a Playground test sheet |
| Learn | `/learn` | Short, public-safe notes on Firework products and integrations, including a tickable go-live checklist |
| Data | `/feeds/google.xml`, `/feeds/firework-products.csv`, `/api/products.json` | Product feeds for Firework import and a mock commerce API |

Add `?debug` to any page for the event overlay, Firework's telemetry console and the `debug_fwn` switch.

## Run it locally

You need Node 24 (see `.nvmrc`).

```sh
nvm use
npm ci
npm run dev          # http://localhost:4321
```

Widgets load the Fjordbloom sandbox channel and playlists from `src/site.config.ts`. To see a different channel, click the gear icon or add `?channel=your_channel` to the URL.

## Use it with your own sandbox

You don't need to fork or redeploy. Settings are saved in your browser only.

| How | Example |
|---|---|
| Settings dialog (gear icon) | Channel name plus one playlist per page slot |
| `?channel=` | `/lab/storyblock?channel=my_sandbox` |
| `?playlist=` | Forces one playlist on every widget of the page |
| `?fw=off` or `?fw=lazy` | Skip the SDK, or load it with `fwn-async.js` |
| `?a.<attribute>=` and `?css.<variable>=` | Lab pages only. "Copy link to this setup" builds these |

Purchase tracking only fires for the sandbox channel in `src/site.config.ts`. Viewing anyone else's channel never sends test orders to their analytics.

## Present a pitch

Open `/pitch` and click **Start presenting**, or add `?present=<pitch-id>` to any page. Pitch mode lasts for the browser tab. It hides the Lab and Learn links, the settings button and the notes that explain the demo. The demo store banner stays.

- **Step control.** A small control at the bottom left moves between steps. The `[` and `]` keys do the same, and `\` hides it.
- **Presenter notes.** **Notes** opens `/pitch/<id>` in a separate window. It follows the shared tab, shows the elapsed time, and can send the shared tab to any step.
- **Leave.** Click **×** in the control, or open any page with `?present=off`.

Pitch scripts are YAML files in `content/pitches/`, checked by `npm run validate`. Keep them public-safe: no prices, customer names or internal figures. Mark other explanatory elements with `data-demo-chrome` to hide them in pitch mode.

## Generate content

Products live in `content/catalog/products.json`. Videos are described in `content/videos/*.yaml`. The pipeline needs `ffmpeg` (`brew install ffmpeg`) and, for the paid steps, a fal.ai key in `.env`. Copy `.env.example` to get started.

| Step | Command | Cost |
|---|---|---|
| Placeholder product images | `npm run gen:placeholders` | Free |
| AI product images | `npm run gen:images -- --run` | About $1.70 for the catalog |
| AI video clips | `npm run gen:clips -- --run` | About $10 for the first ten videos |
| Voice-over | `npm run gen:voice -- --run` | About $0.10 |
| Final videos | `npm run gen:compose` | Free (local ffmpeg) |
| Live show | `npm run gen:live-show` | Free |
| Business Portal checklist | `SITE_URL=https://… npm run fw:checklist` | Free |

Paid commands dry-run by default and print the estimated cost. Total spend is capped by `GEN_MAX_USD` and logged in `content/ledger.json`. Without AI clips, `gen:compose` animates the product images, so you can upload working videos before spending anything. Rendered media goes to `out/`, which is gitignored.

## Checks

```sh
npm run validate      # catalog and video specs
npm run check         # TypeScript and Astro
npm run lint:secrets  # secret scan (also runs on every commit)
npm run test:smoke    # Playwright, desktop and mobile; set BASE_URL to test a deploy preview
```

## Deploy

Netlify builds from `netlify.toml`: `npm run build`, publish `dist`. Pull requests get deploy previews. On Netlify's credit-based free plan each production deploy uses credits, so merge to `main` in batches.

## Project layout

```
src/pages/          storefront, lab, learn, feeds and mock API
src/lab/registry.ts components, attributes, CSS variables, events and known tickets
src/scripts/        Firework loader, settings, event tap, debug overlay, cart, tracking, pitch mode, overlays, a11y
src/site.config.ts  public Firework IDs: channel, playlists and the AVA assistant
content/            catalog, brand, video specs, pitch scripts, spend ledger
scripts/gen/        image, clip, voice and video generation
scripts/firework/   Business Portal checklist (API scripts come later)
tests/              Playwright smoke tests
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. The repository is public, so its rules on secrets and internal information matter.
