---
layout: ../../layouts/Learn.astro
title: Products and IDs
description: How a catalog gets into Firework, and why one consistent external ID saves most product tickets.
order: 3
updated: 27 Oct 2026
---

## The data model in one picture

- A **business** has one or more **channels**. Channels hold videos, which are grouped into **playlists**.
- A business also has a **business store**, which holds **products**. Each product has one or more **units** (variants).
- Videos are tagged with products. Widgets, hydration and purchase tracking all find products by **external ID**.

## Four ways to import products

| Path | Best for | Notes |
|---|---|---|
| Platform integration | Shopify, SFCC, Magento, WooCommerce, BigCommerce | IDs come from the platform. |
| CSV batch import | One-off uploads | One row per unit. Columns include Product External ID and Product Unit External ID. |
| Google XML feed | Catalogs that change | Turn on auto-sync with a refresh of 4, 6, 12 or 24 hours. Optional "delete missing products". |
| Public API upsert | Custom storefronts and automation | `POST /api/v1/products` merges units. A business store must exist first. |

This site generates the first two from one catalog file:

- [Google XML feed](/feeds/google.xml), for Business Portal's "Import via Google XML" with auto-sync.
- [Firework CSV](/feeds/firework-products.csv), in the exact column order of Firework's template.

## One ID, everywhere

| Where | Field | Fjordbloom example |
|---|---|---|
| Google XML | `g:item_group_id`, `g:id` | `FJB-103`, `FJB-103-30ML` |
| CSV | Product External ID, Product Unit External ID | `FJB-103`, `FJB-103-30ML` |
| API | `external_id`, `product_units[].external_id` | `FJB-103`, `FJB-103-30ML` |
| Product page widget | `skus` | `FJB-103` |
| Purchase event | `line_items[].sku` | `FJB-103-30ML` |

## Tickets this explains

- **"The product page shows no videos."** The `skus` value does not match the product's external ID in Firework, or no published video is tagged with that product.
- **"Products appear twice."** Two import paths used different IDs for the same product.
- **"Revenue is not attributed."** The purchase `sku` values do not match units or products Firework knows.
- **"Prices in the player are wrong."** The feed has not synced yet. Product hydration fixes this by asking the merchant's own API at play time.

Sources: [Importing products](https://docs.firework.com/firework-for-developers/additional-resources/importing-products-to-firework), [XML auto-sync](https://firework.com/help/xml-auto-sync), [Products API](https://docs.firework.com/firework-for-developers/api/products), [Purchase tracking](https://docs.firework.com/firework-for-developers/web/integration-guide/shopping-integration-v2/tracking/purchase).
