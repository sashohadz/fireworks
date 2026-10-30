---
layout: ../../layouts/Learn.astro
title: Web components in five minutes
description: How the Firework script loads, which tag does what, and the attributes that matter most.
order: 2
updated: 30 Oct 2026
---

## Load the script once

One script powers every widget. The docs recommend the ES module build with a fallback for old browsers:

```html
<script async type="module" src="https://asset.fwcdn3.com/js/module/fwn.js"></script>
<script async nomodule src="https://asset.fwcdn3.com/js/fwn.js"></script>
```

No API key is needed on the page. Only public identifiers appear: the channel name and playlist IDs.

For a faster first load, `fwn-async.js` (about 1 kB) delays the main script until a widget scrolls into view. Older pages may use the per-widget scripts `embed-feed.js` or `storyblock.js`.

## Pick the right tag

| Tag | Use it for | Try it |
|---|---|---|
| `<fw-embed-feed>` | Carousel, grid, dynamic carousel, horizontal carousel and stories | [Lab](/lab/carousel-grid) |
| `<fw-storyblock>` | An inline, autoplaying player, or a floating one with `mode="pinned"` | [Lab](/lab/storyblock) |
| `<fw-player-deck>` | Playing tiles with product cards, as a row or grid | [Lab](/lab/player-deck) |
| `<fw-herounit>` | Full-width livestream promotion with countdown | [Lab](/lab/hero-unit) |
| `<fw-player>` | A floating standalone player, or an inline 16:9 horizontal player | [Lab](/lab/floating-player) |

## One element, many layouts

Business Portal's Add to Site offers 12 layouts, but they come down to five elements. Most layouts are one element with different attributes. See them all live on [All 12 layouts](/lab/layouts).

| Business Portal layout | Element | Attributes that make it |
|---|---|---|
| Carousel | `<fw-embed-feed>` | `mode="row"` (the default) |
| Grid | `<fw-embed-feed>` | `mode="grid"` |
| Dynamic Carousel | `<fw-embed-feed>` | `thumbnail_style="dynamic"` |
| Horizontal Carousel | `<fw-embed-feed>` | `thumbnail_orientation="horizontal"` |
| Circle Stories | `<fw-embed-feed>` | `thumbnail_shape="circle"`, or `mode="stories"` |
| Vertical Stories | `<fw-embed-feed>` | `thumbnail_shape="rectangle"` |
| Player Deck | `<fw-player-deck>` | none |
| Player Deck Grid | `<fw-player-deck>` | `mode="grid"` |
| Story Block | `<fw-storyblock>` | none |
| Floating Player | `<fw-storyblock>` | `mode="pinned"`. The docs also show `<fw-player mode="pinned">` |
| Horizontal Player | `<fw-player>` | inline, with `style="width: 100%; aspect-ratio: 16/9"` |
| Hero Unit | `<fw-herounit>` | none |

Player Deck is itself the embed feed with a player-deck layout switched on. The three `thumbnail_*` attributes are not in the developer docs yet; they come from Business Portal's embed code and the SDK. Circle and vertical stories also take `size` (small, medium or large), `pulse_animation` and the CSS variable `--fw-thumbnail-pulse-animation-color`, which the help center documents.

## Choose the content

Every widget needs `channel`. Then narrow it with **one** of these:

- `playlist` or `playlist_collection` for curated content.
- `skus="FJB-103"` to show videos tagged with a product. This is what product pages use.
- `hashtag="(and fjb103)"` to filter by hashtag. It works with `channel` only, not with `playlist`.
- `video` to force one video first.

When a source comes back empty, `priority` decides the fallback order.

## Shape the experience

- **Where the player opens:** `open_in` is `default`, `_modal`, `_self` or `_blank`.
- **Autoplay and captions:** `autoplay` and `captions`, both on by default.
- **Floating player:** `player_placement`, `player_margin` and `dock`.
- **Theming:** CSS variables such as `--fw-thumbnail-border-radius` and `--fw-cta-button-background`, plus `ui_*` attributes such as `ui_primary_color`. Try them in the [styling playground](/lab/styling).

## Listen to events

Widgets dispatch `CustomEvent`s on `document`, named `fw:<widget>:<event>`, for example `fw:embed-feed:thumbnail-click` or `fw:storyblock:impression`. Every event's `detail` includes `app_id`, `name`, `widget_id` and `guest_id`. Add `?debug` to any page here to watch them.

Sources: [Integration guide](https://docs.firework.com/firework-for-developers/web/integration-guide), [Feed attributes](https://docs.firework.com/firework-for-developers/web/integration-guide/feed-attributes), [Styling](https://docs.firework.com/firework-for-developers/web/integration-guide/styling), [Events](https://docs.firework.com/firework-for-developers/web/integration-guide/events).
