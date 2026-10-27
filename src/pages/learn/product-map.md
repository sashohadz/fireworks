---
layout: ../../layouts/Learn.astro
title: Firework product map
description: The four customer-facing surfaces, the AI layer behind them, and where each one shows up on this site.
order: 1
updated: 27 Oct 2026
---

Firework sells video commerce to retailers and brands. Customers manage everything in **Business Portal** (the CMS) and put it on their sites with web components, mobile SDKs or platform apps.

## The four surfaces

| Surface | What the shopper sees | On this site |
|---|---|---|
| **Shoppable Video** | Short vertical videos with tagged products: carousels, grids, Storyblocks, Player Decks and floating players. | [Home](/), [Shop](/shop), every product page, [Lab](/lab) |
| **Video Showroom** | Livestreams and replays with pinned products, chat, giveaways and an AI co-pilot. Promoted with the Hero unit. | [Live](/live), [Showroom](/showroom) |
| **One-to-One video chat** | A shopper books or starts a video call with a store associate. Common for high-ticket items. | Not demoed yet |
| **AVA (AI shopping agent)** | An AI assistant that answers product and policy questions, by chat or voice, and can sit next to videos. | [Help](/help), product FAQs |

## The AI layer

- **AI content generation (AIGC):** turning product photos into video. This demo's own videos are made the same way, with image-to-video models.
- **AI content curation (AICC):** finding social videos and mapping existing videos to products. The Public API exposes AI product matching for videos.
- **AI Copilot:** helps hosts moderate livestreams and answer viewers in real time.

## How customers connect their catalog

Products reach Firework through a platform integration (Shopify, Salesforce Commerce Cloud, Magento, WooCommerce, BigCommerce), a CSV upload, a Google XML feed with auto-sync, or the Public API. See [Products and IDs](/learn/products-and-ids).

## Where the data goes

Every widget sends engagement events, and the site sends a **purchase event** on the order confirmation page. Firework uses these to attribute revenue to videos in Insights.

Sources: [Get started](https://firework.com/docs/get-started), [Shoppable video](https://firework.com/docs/shoppable-video), [Video Showroom](https://firework.com/docs/video-showroom), [AVA](https://firework.com/docs/ava-ai-virtual-assistant).
