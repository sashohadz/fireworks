---
layout: ../../layouts/Learn.astro
title: First checks on an embed ticket
description: A public-safe checklist for "the widget doesn't show" and friends, with links to live repros.
order: 4
updated: 27 Oct 2026
---

## 1. Is the script on the page?

Open the browser console and type `window._fwn`. If it is `undefined`, the Firework script never loaded. Check the script tag, consent tools that block it, and the network tab for blocked requests.

## 2. Open Firework's telemetry console

Run `window._fwn.console()` in the browser console. A bookmarklet makes it one click on any customer page:

```text
javascript: (window._fwn ? window._fwn.console() : alert('FWN could not be found.'))
```

On this site, the debug overlay (`?debug`) has a button for it.

## 3. Is the embed in sandbox mode?

If an embed silently shows nothing, add `debug_fwn=true` to the page URL. It bypasses Firework's sandbox mode.

## 4. Read the events

Widgets dispatch `fw:*` events on `document`. An `fw:embed-feed:error` means the feed could not be shown. Seeing `render` but never `content-ready` points at the content source: a wrong channel, playlist, hashtag or `skus` value.

In practice each event arrives twice: once on the widget element and once on `document`. Count them once when you compare numbers with Insights. The SDK also emits many events the docs don't list yet, such as `fw:ready`, `fw:shopping:configure`, `fw:video:start` and `fw:video:first-quartile`. The debug overlay shows all of them.

## 5. Check the usual suspects

| Symptom | Likely cause | Fix |
|---|---|---|
| Docked player scrolls with the page | CSS `transform` on an ancestor | `reset_transform="always"`. [Repro](/lab/issues/docked-storyblock-transform) |
| Floating player too big on mobile | Default size fits IAB ads | `--fw-player-width` and `--fw-player-height` in a media query. [Repro](/lab/issues/floating-player-mobile) |
| Picture-in-picture falls back to fullscreen | Site forbids same-origin framing | Allow `frame-ancestors 'self'` |
| Needs a double click | FastClick library | Remove it, or add `class="needsclick"` |
| Videos open in a new tab | Widget inside an iframe, AMP or Google Ad Manager | Expected: iframes ignore `open_in` |
| Feed loads slowly on a heavy site | Other scripts compete | Move the script into `<head>`, then use the telemetry console |
| Blocked requests | Firewall or Content Security Policy | Allow Firework's service domains |

## 6. Write it up

Summarise each ticket as **symptom, cause, fix**. Keep customer names and URLs in internal tools, never in this public repo.

Sources: [FAQ and troubleshooting](https://docs.firework.com/firework-for-developers/web/faq-and-troubleshooting), [Telemetry console](https://docs.firework.com/firework-for-developers/web/telemetry-console), [Service domains](https://docs.firework.com/firework-for-developers/web/firework-service-domains).
