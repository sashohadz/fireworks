// Single source of truth for the lab: every Firework web component we demo, with its documented
// attributes, CSS variables, events, docs links and known support tickets.
// Sources: https://docs.firework.com/firework-for-developers/web/integration-guide (Oct 2026).
import { portalLayouts, type PortalLayout } from './layouts';
import type { PlaylistSlot } from '../site.config';

export type AttrType = 'text' | 'number' | 'boolean' | 'enum';
export type AttrGroup = 'Content source' | 'Layout' | 'Player' | 'Shopping' | 'Styling attributes';

export interface AttrDef {
  name: string;
  type: AttrType;
  group: AttrGroup;
  description: string;
  values?: string[];
  /** Documented default, shown as a hint only. */
  default?: string;
}

export interface KnownIssue {
  title: string;
  body: string;
  /** Lab repro page, if we have one. */
  repro?: string;
  docs?: string;
}

export interface LabComponent {
  /** Business Portal layouts built on this element, from src/lab/layouts.ts. Filled in below. */
  layouts?: PortalLayout[];
  slug: string;
  title: string;
  tag: 'fw-embed-feed' | 'fw-storyblock' | 'fw-player-deck' | 'fw-herounit' | 'fw-player';
  summary: string;
  whenToUse: string;
  slot?: PlaylistSlot;
  usePlaylist: boolean;
  /** Attributes the lab starts with (besides channel and playlist). */
  initial: Record<string, string>;
  attrs: AttrDef[];
  cssVars: string[];
  events: string[];
  docs: { label: string; url: string }[];
  noCode: string;
  knownIssues: KnownIssue[];
}

const DOCS = 'https://docs.firework.com/firework-for-developers/web';

// ---------- shared attribute sets ----------
const sourceAttrs: AttrDef[] = [
  { name: 'channel', type: 'text', group: 'Content source', description: 'Channel name. Every widget needs it.' },
  { name: 'playlist', type: 'text', group: 'Content source', description: 'Playlist ID. Needs channel.' },
  { name: 'playlist_collection', type: 'text', group: 'Content source', description: 'Playlist collection ID. Needs channel.' },
  { name: 'hashtag', type: 'text', group: 'Content source', description: 'Hashtag filter as an s-expression, e.g. (and fjb103). Works with channel only, not with playlist.' },
  { name: 'skus', type: 'text', group: 'Content source', description: 'Comma-separated product external IDs. Shows videos tagged with those products.' },
  { name: 'video', type: 'text', group: 'Content source', description: 'Encoded video ID to show first.' },
  { name: 'priority', type: 'text', group: 'Content source', default: 'skus,playlist,hashtag,playlist_collection', description: 'Fallback order when a source returns nothing.' },
  { name: 'jsonld', type: 'boolean', group: 'Content source', default: 'false', description: 'Injects JSON-LD video schema into the page head.' },
];

const playerAttrs: AttrDef[] = [
  { name: 'player_placement', type: 'enum', group: 'Player', values: ['top-left', 'top-right', 'bottom-right', 'bottom-left'], default: 'bottom-right', description: 'Corner of the minimised player.' },
  { name: 'player_margin', type: 'text', group: 'Player', description: 'CSS distance of the minimised player from the screen edges.' },
  { name: 'player_minimize', type: 'boolean', group: 'Player', default: 'true', description: 'Allows the player to be minimised.' },
  { name: 'player_fullscreen', type: 'boolean', group: 'Player', default: 'true', description: 'Shows the fullscreen button.' },
  { name: 'muted', type: 'boolean', group: 'Player', default: 'false', description: 'Opens fullscreen videos muted.' },
  { name: 'player_unmute', type: 'boolean', group: 'Player', default: 'false', description: 'Shows or hides unmute-related UI.' },
  { name: 'pip', type: 'boolean', group: 'Player', default: 'false', description: 'Enhanced picture-in-picture. The page must allow same-origin framing.' },
  { name: 'pip_navigate', type: 'boolean', group: 'Player', default: 'true', description: 'Whether links clicked in PiP navigate.' },
  { name: 'pip_target', type: 'enum', group: 'Player', values: ['_self', '_blank'], description: 'Where PiP links open.' },
  { name: 'product_card', type: 'boolean', group: 'Player', default: 'true', description: 'Shows the product card carousel in the player.' },
  { name: 'hide_show_detail', type: 'boolean', group: 'Player', default: 'false', description: 'Hides the show-detail button on the product detail view.' },
  { name: 'reset_transform', type: 'enum', group: 'Player', values: ['fullscreen', 'always', 'never'], description: 'Removes CSS transforms from ancestors while the player is open. Fixes docked players that scroll with the page.' },
  { name: 'share', type: 'enum', group: 'Player', values: ['hash', 'query', 'false'], description: 'How share links point back to your page. false hides sharing.' },
  { name: 'share_template', type: 'text', group: 'Player', description: 'Base URL for share links, used with share.' },
  { name: 'ui_asset_next', type: 'text', group: 'Styling attributes', description: 'URL of a custom next arrow, used by carousel arrows and the player. SVG, public and CORS-enabled. Lab links only keep this site\'s /arrows/ files.' },
  { name: 'ui_asset_previous', type: 'text', group: 'Styling attributes', description: 'URL of a custom previous arrow. Same rules as ui_asset_next. See /lab/arrows.' },
];

const stylingAttrs: AttrDef[] = [
  { name: 'ui_primary_color', type: 'text', group: 'Styling attributes', description: 'Accent colour, e.g. #2F5D73.' },
  { name: 'ui_button_color', type: 'text', group: 'Styling attributes', description: 'CTA button background colour.' },
  { name: 'ui_button_font_color', type: 'text', group: 'Styling attributes', description: 'CTA button text colour.' },
  { name: 'ui_border_style', type: 'enum', group: 'Styling attributes', values: ['rounded', 'hard'], default: 'rounded', description: 'Rounded (about 14px) or square corners.' },
  { name: 'ui_font_css', type: 'text', group: 'Styling attributes', description: 'URL of a CSS file that loads a custom font.' },
  { name: 'ui_share_sheet', type: 'text', group: 'Styling attributes', default: 'facebook,twitter,whatsapp,sms,copy,native', description: 'Comma-separated share options.' },
];

const pick = (list: AttrDef[], names: string[]) => names.map((n) => list.find((a) => a.name === n)!).filter(Boolean);

const playerCssVars = [
  '--fw-player-background',
  '--fw-player-border-radius',
  '--fw-player-width',
  '--fw-player-height',
  '--fw-player-margin',
  '--fw-player-inset',
  '--fw-product-name-font-color',
  '--fw-product-image-background-color',
  '--fw-caption-background-color',
  '--fw-caption-color',
  '--fw-cta-button-background',
  '--fw-cta-button-color',
  '--fw-cta-button-border-radius',
];

const embedFeedEvents = [
  'fw:embed-feed:render',
  'fw:embed-feed:content-ready',
  'fw:embed-feed:impression',
  'fw:embed-feed:thumbnail-load',
  'fw:embed-feed:thumbnail-click',
  'fw:embed-feed:error',
];
const storyblockEvents = ['fw:storyblock:render', 'fw:storyblock:impression'];

const noCodeWidget = (kind: string) =>
  `In Business Portal, open the playlist, click Add to Site, choose the ${kind} layout and check the preview. Then click Copy Code and paste the code into the page.`;

// ---------- components ----------
export const labComponents: LabComponent[] = [
  {
    slug: 'carousel-grid',
    title: 'Carousel, grid and stories',
    tag: 'fw-embed-feed',
    summary: 'One element behind six Business Portal layouts: carousel, grid, dynamic carousel, horizontal carousel, circle stories and vertical stories. Clicking a thumbnail opens the player.',
    whenToUse: 'Home pages, category pages and campaign landing pages. The most common first integration.',
    slot: 'carousel',
    usePlaylist: true,
    initial: { mode: 'row' },
    attrs: [
      ...sourceAttrs,
      { name: 'mode', type: 'enum', group: 'Layout', values: ['row', 'grid', 'pinned', 'stories'], default: 'row', description: 'row is the carousel, grid is the grid, pinned starts as a floating player. stories is a shortcut for circle stories.' },
      { name: 'size', type: 'enum', group: 'Layout', values: ['small', 'medium', 'large'], default: 'large', description: 'Thumbnail size. Ignored in grid mode. small is mostly used for stories.' },
      { name: 'thumbnail_style', type: 'enum', group: 'Layout', values: ['video', 'dynamic'], default: 'video', description: 'dynamic is the Dynamic Carousel: columns follow the container width. Not in the developer docs yet.' },
      { name: 'thumbnail_orientation', type: 'enum', group: 'Layout', values: ['vertical', 'horizontal'], default: 'vertical', description: 'horizontal is the Horizontal Carousel, for 16:9 videos. Not in the developer docs yet.' },
      { name: 'thumbnail_shape', type: 'enum', group: 'Layout', values: ['circle', 'rectangle', 'square'], description: 'circle is Circle Stories, rectangle is Vertical Stories. Ignored with thumbnail_style="dynamic" or a horizontal orientation.' },
      { name: 'pulse_animation', type: 'boolean', group: 'Layout', default: 'true', description: 'The pulsing ring on story thumbnails.' },
      { name: 'nav_arrows', type: 'boolean', group: 'Layout', default: 'true', description: 'Shows the previous and next arrows on the row. Customise them with ui_asset_next and ui_asset_previous.' },
      { name: 'placement', type: 'enum', group: 'Layout', values: ['top', 'middle', 'bottom'], description: 'Informational: where on the page the widget sits.' },
      { name: 'open_in', type: 'enum', group: 'Layout', values: ['default', '_modal', '_self', '_blank'], default: 'default', description: 'Where the player opens on thumbnail click.' },
      { name: 'max_videos', type: 'number', group: 'Layout', description: 'Maximum videos in grid mode. 0 means infinite scroll.' },
      { name: 'paginate_by', type: 'number', group: 'Layout', description: 'Grid page size behind a Load more button. Approximate, to avoid orphan thumbnails.' },
      { name: 'autoplay', type: 'boolean', group: 'Layout', default: 'true', description: 'Autoplays the first thumbnail.' },
      { name: 'captions', type: 'boolean', group: 'Layout', default: 'true', description: 'Shows titles on autoplaying thumbnails.' },
      { name: 'title', type: 'text', group: 'Layout', description: 'Heading for grid mode. Defaults to a localised "Stories and Short Videos".' },
      { name: 'product_tag_placement', type: 'enum', group: 'Shopping', values: ['top', 'bottom', 'false'], default: 'top', description: 'Product tag position on thumbnails, or hidden.' },
      { name: 'thumbnail_cta', type: 'boolean', group: 'Shopping', default: 'false', description: 'Renders CTAs inside carousel thumbnails.' },
      { name: 'thumbnail_product_card', type: 'boolean', group: 'Shopping', default: 'false', description: 'Shows product cards inside carousel thumbnails.' },
      ...playerAttrs,
      ...stylingAttrs,
    ],
    cssVars: [
      '--fw-thumbnail-border-radius',
      '--fw-thumbnail-aspect-ratio',
      '--fw-thumbnail-width',
      '--fw-thumbnail-height',
      '--fw-thumbnail-gap',
      '--fw-thumbnail-justify',
      '--fw-thumbnail-font-size',
      '--fw-thumbnail-font-weight',
      '--fw-font-family',
      '--fw-title-color',
      '--fw-ad-badge-background',
      '--fw-ad-badge-font-color',
      '--fw-thumbnail-pulse-animation-color',
    ],
    events: embedFeedEvents,
    docs: [
      { label: 'Carousel / Grid', url: `${DOCS}/integration-guide/components/carousel-grid` },
      { label: 'Feed attributes', url: `${DOCS}/integration-guide/feed-attributes` },
      { label: 'Player attributes', url: `${DOCS}/integration-guide/player/player-attributes` },
      { label: 'Styling', url: `${DOCS}/integration-guide/styling` },
    ],
    noCode: noCodeWidget('carousel, grid, dynamic carousel, horizontal carousel or stories'),
    knownIssues: [
      { title: 'Widget needs a double click', body: 'Usually the FastClick library on the site. Remove it, or add class="needsclick" to the Firework widget.', docs: `${DOCS}/faq-and-troubleshooting` },
      { title: 'Grid shows a different number of videos than max_videos or paginate_by', body: 'Both numbers are approximate on purpose, so no thumbnail is left alone on the last row.' },
      { title: 'Videos open in a new tab', body: 'Widgets inside iframes, AMP or Google Ad Manager ignore open_in and always open fw.tv in a new tab.' },
      { title: 'Display ads between grid rows', body: 'Put an element with slot="grid-row-2" (any row index) inside <fw-embed-feed> to span that row.' },
      { title: 'Custom arrow does not show', body: 'Check that ui_asset_next and ui_asset_previous point to public SVG files whose host allows the site in CORS, and that nav_arrows is not false. PNG or JPG arrows show as background images and ignore the widget colour.', repro: '/lab/arrows', docs: `${DOCS}/integration-guide/player/player-attributes/appearance-configuration` },
      { title: 'Circle Stories show as rounded squares', body: 'A site-wide --fw-thumbnail-border-radius, for example on :root, also shapes story thumbnails. Reset it on the stories element: fw-embed-feed[thumbnail_shape="circle"] { --fw-thumbnail-border-radius: initial; }' },
    ],
  },
  {
    slug: 'storyblock',
    title: 'Storyblock',
    tag: 'fw-storyblock',
    summary: 'An inline, autoplaying vertical player that sits in the page like a story. It can dock to a floating player on scroll.',
    whenToUse: 'Hero spots, product pages and editorial content where the video itself should play in the page.',
    slot: 'storyblock',
    usePlaylist: true,
    initial: { height: '600px' },
    attrs: [
      ...sourceAttrs,
      { name: 'height', type: 'text', group: 'Layout', default: '75vh', description: 'CSS height. Without it, the block uses the parent height, up to 75% of the viewport.' },
      { name: 'max_videos', type: 'number', group: 'Layout', description: 'Limits the number of videos.' },
      { name: 'loop', type: 'boolean', group: 'Layout', default: 'false', description: 'Loops the feed.' },
      { name: 'dock', type: 'boolean', group: 'Layout', default: 'false', description: 'Docks into a minimised player when scrolled out of view.' },
      { name: 'mode', type: 'enum', group: 'Layout', values: ['pinned', 'fullscreen'], description: 'Start minimised or fullscreen instead of inline.' },
      { name: 'player_captions', type: 'boolean', group: 'Layout', default: 'true', description: 'Video title overlay in the player.' },
      { name: 'name', type: 'text', group: 'Layout', description: 'Widget name. Lets scripts control it through window._fwn.players[name].' },
      { name: 'page_url', type: 'text', group: 'Layout', description: 'Only inside iframes: the real page URL for attribution.' },
      ...playerAttrs,
      ...stylingAttrs,
    ],
    cssVars: ['--fw-storyblock-background', '--fw-storyblock-border-radius', '--fw-font-family', ...playerCssVars],
    events: storyblockEvents,
    docs: [
      { label: 'Storyblock (web)', url: `${DOCS}/integration-guide/components/storyblock` },
      { label: 'Feed attributes', url: `${DOCS}/integration-guide/feed-attributes` },
      { label: 'Web SDK player control', url: `${DOCS}/integration-guide/web-sdk` },
    ],
    noCode: noCodeWidget('Storyblock'),
    knownIssues: [
      { title: 'Docked Storyblock scrolls with the page', body: 'An ancestor element has a CSS transform. Remove it, or set reset_transform="always".', repro: '/lab/issues/docked-storyblock-transform', docs: `${DOCS}/faq-and-troubleshooting` },
      { title: 'Storyblock is too tall or leaves blank space', body: 'Without a height attribute it fills the parent up to 75vh. Set height explicitly, e.g. height="600px", and check the parent container.' },
      { title: 'iframe or AMP integration', body: 'No fullscreen or PiP, videos open on fw.tv in a new tab, and page_url is needed for attribution.' },
    ],
  },
  {
    slug: 'player-deck',
    title: 'Player Deck',
    tag: 'fw-player-deck',
    summary: 'A row (deck) or grid of playing tiles with product cards in each slot. More shoppable than a plain carousel.',
    whenToUse: 'Category and product pages where shoppers should see products next to every video.',
    slot: 'deck',
    usePlaylist: true,
    initial: { mode: 'row' },
    attrs: [
      ...sourceAttrs,
      { name: 'mode', type: 'enum', group: 'Layout', values: ['row', 'grid'], default: 'row', description: 'row is the deck, grid is Player Deck Grid.' },
      { name: 'size', type: 'enum', group: 'Layout', values: ['medium', 'large'], default: 'large', description: 'Thumbnail size in deck mode only.' },
      { name: 'nav_arrows', type: 'boolean', group: 'Layout', default: 'true', description: 'Shows the previous and next arrows on the deck.' },
      { name: 'max_videos', type: 'number', group: 'Layout', description: 'Caps how many videos load. In grid mode they load in chunks.' },
      { name: 'paginate_by', type: 'number', group: 'Layout', description: 'Grid only: rows behind a Load more button. Approximate.' },
      { name: 'title', type: 'text', group: 'Layout', description: 'Grid only: heading above the unit.' },
      { name: 'autoplay', type: 'boolean', group: 'Layout', default: 'true', description: 'Autoplays the first visible tile.' },
      { name: 'captions', type: 'boolean', group: 'Layout', default: 'true', description: 'Titles on autoplaying tiles.' },
      { name: 'open_in', type: 'enum', group: 'Layout', values: ['default', '_self', '_blank'], default: 'default', description: 'Where a tile click opens.' },
      { name: 'shopping_quick_add', type: 'boolean', group: 'Shopping', default: 'false', description: 'Quick-add button for in-stock, single-variant, hydrated products. Deck only.' },
      { name: 'shopping_quick_view', type: 'boolean', group: 'Shopping', default: 'false', description: 'Quick-view button for multi-variant products on supported themes. Deck only.' },
      { name: 'product_tag_placement', type: 'enum', group: 'Shopping', values: ['top', 'bottom', 'false'], default: 'top', description: 'Product tag position, or hidden.' },
      { name: 'thumbnail_cta', type: 'boolean', group: 'Shopping', default: 'false', description: 'CTAs inside the tile.' },
      { name: 'thumbnail_product_card', type: 'boolean', group: 'Shopping', default: 'false', description: 'Product card inside the tile as well as in the deck slot.' },
      ...playerAttrs,
      ...stylingAttrs,
    ],
    cssVars: [
      '--fw-player-deck-product-card-font-weight',
      '--fw-player-deck-product-card-font-color',
      '--fw-player-deck-product-card-discount-price-font-color',
      '--fw-player-deck-product-card-font-size',
      '--fw-font-family',
      ...playerCssVars,
    ],
    events: embedFeedEvents,
    docs: [
      { label: 'Player Deck / Grid', url: `${DOCS}/integration-guide/components/player-deck-grid` },
      { label: 'Product cards', url: `${DOCS}/integration-guide/video-customization/cta-button-configuration-1` },
    ],
    noCode: noCodeWidget('Player Deck'),
    knownIssues: [
      { title: 'Quick add or quick view does not appear', body: 'Quick add needs an available, in-stock, single-variant product hydrated by the shopping integration. Quick view needs a supported theme and a multi-variant product.' },
      { title: 'Player Deck CSS variables do nothing', body: 'The --fw-player-deck-* variables only work at global scope (:root, html or body), not on the element.' },
    ],
  },
  {
    slug: 'hero-unit',
    title: 'Hero unit',
    tag: 'fw-herounit',
    summary: 'A large, full-width unit that promotes a livestream with a countdown, then plays it live and as a replay.',
    whenToUse: 'Home page or campaign page ahead of a live shopping event.',
    slot: 'hero',
    usePlaylist: true,
    initial: { height: '70vh' },
    attrs: [
      ...sourceAttrs,
      { name: 'height', type: 'text', group: 'Layout', default: '75vh', description: 'CSS height of the unit.' },
      { name: 'hero_text_mode', type: 'enum', group: 'Layout', values: ['even', 'stretched'], default: 'even', description: 'Space split between countdown and video.' },
      { name: 'hero_flip_order', type: 'boolean', group: 'Layout', default: 'false', description: 'Swaps video and countdown.' },
      { name: 'hero_hide_countdown', type: 'boolean', group: 'Layout', default: 'false', description: 'Hides the countdown.' },
      { name: 'hero_previous_event_promotion', type: 'boolean', group: 'Layout', default: 'true', description: 'Promotes the previous event when nothing is scheduled.' },
      { name: 'dock', type: 'boolean', group: 'Layout', default: 'false', description: 'Docks to a minimised player when scrolled away (inherited from Storyblock).' },
      ...playerAttrs,
    ],
    cssVars: [
      '--fw-hero-unit-title-font-family',
      '--fw-hero-unit-title-font-size',
      '--fw-hero-unit-title-font-weight',
      '--fw-hero-unit-countdown-font-size',
      '--fw-hero-unit-countdown-font-weight',
      '--fw-hero-unit-cta-font-size',
      '--fw-hero-unit-start-time-font-size',
      ...playerCssVars,
    ],
    events: storyblockEvents,
    docs: [
      { label: 'Hero unit', url: `${DOCS}/integration-guide/components/hero-unit` },
      { label: 'Enable a Hero Unit (help center)', url: 'https://firework.com/help/enable-a-hero-unit' },
    ],
    noCode: 'In Business Portal, create a livestream event (Add videos, Create Livestream Event) and add it to a playlist. Then embed the Hero unit with that playlist.',
    knownIssues: [
      { title: 'No countdown shows', body: 'The playlist has no upcoming livestream. Schedule one, or check hero_hide_countdown.' },
      { title: 'Spacing looks off', body: 'Wrap the unit in a container with padding instead of styling the element itself.' },
    ],
  },
  {
    slug: 'floating-player',
    title: 'Player: floating and horizontal',
    tag: 'fw-player',
    summary: 'A standalone player. With mode="pinned" it floats in a corner; inline, at 16:9, it is the Horizontal Player.',
    whenToUse: 'Site-wide video presence without taking page space, or one horizontal video inside the page. The docs recommend Storyblock if all videos are vertical.',
    slot: 'floating',
    usePlaylist: true,
    initial: { mode: 'pinned', player_placement: 'bottom-right' },
    attrs: [
      ...pick(sourceAttrs, ['channel', 'playlist', 'video']),
      { name: 'mode', type: 'enum', group: 'Layout', values: ['pinned', 'fullscreen'], description: 'Start minimised in a corner, or fullscreen.' },
      { name: 'dock', type: 'boolean', group: 'Layout', default: 'false', description: 'Pins to the bottom of the viewport when scrolled past.' },
      { name: 'width', type: 'text', group: 'Layout', default: '100%', description: 'Explicit width when inline.' },
      { name: 'height', type: 'text', group: 'Layout', default: '100%', description: 'Explicit height when inline.' },
      ...playerAttrs,
    ],
    cssVars: ['--fw-player-width', '--fw-player-height', '--fw-player-margin', '--fw-player-inset', '--fw-player-background', '--fw-player-border-radius'],
    events: [],
    docs: [
      { label: 'Floating player', url: `${DOCS}/integration-guide/components/channel-button` },
      { label: 'Player attributes', url: `${DOCS}/integration-guide/player/player-attributes` },
    ],
    noCode: noCodeWidget('floating player or horizontal player'),
    knownIssues: [
      { title: 'Floating player is too big on mobile', body: 'The default size is chosen so IAB video ads fit. Shrink it with --fw-player-width and --fw-player-height in a media query, knowing ads may break.', repro: '/lab/issues/floating-player-mobile', docs: `${DOCS}/faq-and-troubleshooting` },
      { title: 'Player covers the chat or cookie widget', body: 'Move it with player_placement and player_margin.' },
    ],
  },
  {
    slug: 'pdp-videos',
    title: 'Product page videos',
    tag: 'fw-storyblock',
    summary: 'A Storyblock filtered to videos tagged with one product, using the skus attribute (or a hashtag filter as a fallback).',
    whenToUse: 'Product detail pages. Every product page on this site has one.',
    usePlaylist: false,
    initial: { skus: 'FJB-103', height: '560px' },
    attrs: [
      ...pick(sourceAttrs, ['channel', 'skus', 'hashtag', 'playlist', 'priority']),
      { name: 'height', type: 'text', group: 'Layout', default: '75vh', description: 'CSS height.' },
      { name: 'max_videos', type: 'number', group: 'Layout', description: 'Limits the number of videos.' },
      ...pick(playerAttrs, ['player_placement', 'product_card']),
    ],
    cssVars: ['--fw-storyblock-background', '--fw-storyblock-border-radius'],
    events: storyblockEvents,
    docs: [
      { label: 'FAQ: product-specific videos', url: `${DOCS}/faq-and-troubleshooting` },
      { label: 'Hashtag filtering', url: 'https://docs.firework.com/firework-for-developers/additional-resources/displaying-product-videos-on-product-pages-using-hashtag-filtering-web' },
      { label: 'Adding products to a video', url: 'https://docs.firework.com/firework-for-developers/additional-resources/adding-products-to-a-video' },
    ],
    noCode: 'Tag products to videos in Business Portal (or via the API). The product page template then passes its product ID into skus, which usually needs a developer or a platform app such as the Shopify integration.',
    knownIssues: [
      { title: 'Product page Storyblock is empty', body: 'Check the chain: the product exists in the Firework store, its external ID equals the skus value, and at least one published video is tagged with it.' },
      { title: 'Only one video per SKU', body: 'With several comma-separated SKUs, one video is shown per SKU.' },
      { title: 'Hashtag filter shows nothing', body: 'Hashtags only work with channel, so remove the playlist attribute. In Business Portal, press Enter after typing each hashtag or it is not saved.' },
    ],
  },
];

for (const c of labComponents) c.layouts = portalLayouts.filter((l) => l.labSlug === c.slug);

export const getLabComponent = (slug: string) => labComponents.find((c) => c.slug === slug);

export const attrGroups: AttrGroup[] = ['Content source', 'Layout', 'Shopping', 'Player', 'Styling attributes'];
