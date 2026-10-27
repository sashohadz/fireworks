---
layout: ../../layouts/Learn.astro
title: Go-live checklist
description: What to check before a customer's site goes live with Firework, and before a livestream. Tick items as you go; ticks stay in this browser.
order: 5
updated: 27 Oct 2026
---

## Part 1: before the site goes live

### Script and embeds

- [ ] The Firework script is on every page that has a widget, once per page. Use the module build with the `nomodule` fallback, or `fwn-async.js` to load it only when a widget scrolls into view.
- [ ] Each embed has a `channel`, plus the intended `playlist`, `skus` or `hashtag`. Compare it with the code from Business Portal's **Add to Site**.
- [ ] Every widget shows on the live domain without `debug_fwn=true`. If it only shows with that parameter, the embed is in sandbox mode.
- [ ] `window._fwn.console()` opens the telemetry console without red errors.
- [ ] Each page type was checked on iOS Safari and Android Chrome, where most embed tickets start.

### Products and product pages

- [ ] The product feed or CSV import uses the store's real IDs as Product External ID and Product Unit External ID.
- [ ] Google XML auto-sync is on, with an interval that fits how often prices and stock change.
- [ ] `skus` Storyblocks show the right videos on at least three product pages.
- [ ] Product pages without tagged videos look fine: the empty widget is hidden or has a fallback.

### Shopping and tracking

- [ ] If the cart integration is used, adding to bag in the player updates the site's cart, and the other way round.
- [ ] The order confirmation page calls `_fwn.analytics.purchase()` with `order_id`, `currency`, `subtotal`, `order_value` and `line_items`.
- [ ] Each line item's `sku` matches the IDs imported into Firework.
- [ ] A test order shows a `user:purchase` request in the network tab.

### Privacy and security

- [ ] The customer chose between Firework's default storage behaviour and opt-in with `data-fwparam_cookies_opt_in="true"`.
- [ ] With opt-in, the consent tool calls `_fwn.cookies.enableCookies()` or `setConsent()` for the categories the shopper accepts.
- [ ] Any Content Security Policy allows Firework's hosts, and corporate firewalls allow Firework's service domains.
- [ ] The site allows same-origin framing (`frame-ancestors 'self'`), which picture-in-picture needs.

### Known conflicts

- [ ] No CSS `transform` on an ancestor of a docked Storyblock, or `reset_transform="always"` is set.
- [ ] No FastClick library, or widgets have `class="needsclick"`.
- [ ] Widgets inside iframes, AMP or Google Ad Manager pass `page_url`, and the customer knows videos open in a new tab there.
- [ ] The floating player's mobile size was agreed. Smaller sizes use `--fw-player-width` and `--fw-player-height`, and can break video ads.

### Content and accessibility

- [ ] Videos with speech have a `.vtt` caption file with Closed Captioning switched on.
- [ ] Widgets were checked with the keyboard and an automated audit. See the [accessibility check](/lab/accessibility).

## Part 2: before a livestream

### A week before

- [ ] The event exists in Business Portal with a title and a start time.
- [ ] The event is in the playlist the site's Hero unit uses, and the countdown shows on the site.
- [ ] The products for the show are added to the event, with current prices and stock in the store.
- [ ] The show has a storyline with a beginning, a middle and an end, plus cue cards and a rehearsal.
- [ ] Giveaways, coupons and calls to action are decided, with overlays ready in the [OBS overlay pack](/live/overlays).

### The day before

- [ ] For OBS: canvas 720x1280 at 30 fps, rate control CBR, keyframe interval 2, service Custom, dynamic bitrate on.
- [ ] Bitrate fits a fresh upload speed test, and a test stream ran end to end.
- [ ] For a prerecorded stream: the MP4 is uploaded and transcoded. It takes about 1 to 3 minutes per minute of video, and files can be up to 10 GB.
- [ ] Someone other than the host moderates chat and pins products in Assistant Mode.

### The hour before

- [ ] The Stream URL and this event's own Stream Key are in OBS. Every event gets a new key.
- [ ] Products sit out of frame until they are shown, with labels readable on camera.
- [ ] OBS shows the "starting soon" scene, and the Stats window is open.

### During and after

- [ ] The host greets viewers, explains giveaways early and gives clear calls to action such as "tap the product card below".
- [ ] To end, stop streaming in OBS, then click End Stream in Assistant Mode.
- [ ] The replay is in the right playlist, with its start and end trimmed.
- [ ] Short clips are cut from the replay, and Insights are reviewed with the customer.

Sources: [FAQ and troubleshooting](https://docs.firework.com/firework-for-developers/web/faq-and-troubleshooting), [Cookies management](https://docs.firework.com/firework-for-developers/web/integration-guide/privacy-settings/cookies-management), [Content Security Policy](https://docs.firework.com/firework-for-developers/web/integration-guide/privacy-settings/content-security-policy), [Service domains](https://docs.firework.com/firework-for-developers/web/firework-service-domains), [Purchase tracking](https://docs.firework.com/firework-for-developers/web/integration-guide/shopping-integration-v2/tracking/purchase), [Closed captions](https://firework.com/help/how-to-add-closed-captions-to-your-videos), [Go live with OBS](https://firework.com/help/how-to-go-live-with-third-party-obs), [Stream a prerecorded video](https://firework.com/help/how-to-stream-a-prerecorded-video), [Livestream best practices](https://firework.com/help/what-are-best-practices-for-live-streaming), [Edit replay start and end](https://firework.com/help/select-livestream-replays), [Short clips from a livestream](https://firework.com/help/create-short-clips).
